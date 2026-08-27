require('dotenv').config();
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(StealthPlugin);
const { runAutoLogin } = require('./auth');
const pool = require('./db');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1) + min));
const HEADLESS = process.env.HEADLESS !== 'false';

async function runConnector() {
    console.log('[Connector] Checking for pending leads...');
    let browser = null;
    try {
        // Reset daily actions for all users where last_action_date is before today
        await pool.query(`
            UPDATE Users 
            SET daily_actions_count = 0, last_action_date = CURRENT_DATE 
            WHERE last_action_date < CURRENT_DATE
        `);

        // Fetch a pending lead, ordering by daily_actions_count ASC for round-robin across users
        const leadRes = await pool.query(`
            SELECT l.id as lead_id, l.linkedin_url, c.user_id, u.li_at_cookie, u.daily_actions_count, u.cookie_status
            FROM Leads l
            JOIN Campaigns c ON l.campaign_id = c.id
            JOIN Users u ON c.user_id = u.id
            WHERE l.status = 'pending' AND u.daily_actions_count < 80
            ORDER BY u.daily_actions_count ASC
            LIMIT 1
        `);

        if (leadRes.rows.length === 0) {
            return;
        }

        const lead = leadRes.rows[0];
        console.log(`[Connector] Processing Lead ID: ${lead.lead_id} for User ID: ${lead.user_id}`);

        if (lead.cookie_status === 'invalid' || !lead.li_at_cookie) {
            console.log(`[Connector] User ${lead.user_id} has an invalid or missing cookie in DB. Attempting auto-login...`);
            const loginSuccess = await runAutoLogin(lead.user_id);
            if (loginSuccess) {
                console.log(`[Connector] Auto-login successful. Resuming connector next cycle.`);
            } else {
                console.log(`[Connector] Auto-login failed. User must update credentials manually.`);
            }
            return;
        }

        browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext();
        await context.addCookies([
            {
                name: 'li_at',
                value: lead.li_at_cookie,
                domain: '.linkedin.com',
                path: '/'
            }
        ]);

        const page = await context.newPage();
        
        // Go to feed first to establish session and prevent redirect loops
        try {
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await randomDelay(2000, 4000);
            
            // Check if redirected to login (invalid cookie)
            if (page.url().includes('login') || page.url().includes('signup')) {
                throw new Error('Redirected to login');
            }
        } catch (err) {
            if (err.message.includes('ERR_TOO_MANY_REDIRECTS') || err.message.includes('Redirected to login') || err.message.includes('ERR_ABORTED')) {
                console.error(`[Connector] Invalid li_at cookie detected for user ${lead.user_id}. Attempting auto-login...`);
                if (browser) {
                    await browser.close();
                    browser = null;
                }
                
                const loginSuccess = await runAutoLogin(lead.user_id);
                if (loginSuccess) {
                    console.log(`[Connector] Auto-login successful. Resuming connector next cycle.`);
                } else {
                    console.log(`[Connector] Auto-login failed. User must update credentials manually.`);
                }
                return;
            }
            throw err;
        }

        await page.goto(lead.linkedin_url, { waitUntil: 'domcontentloaded' });
        await randomDelay(3000, 6000);

        // Simulate some scrolling on the profile
        await page.evaluate(() => window.scrollBy(0, 300));
        await randomDelay(2000, 5000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await randomDelay(1000, 3000);

        try {
            // Target the main profile area to avoid clicking sidebar suggestions
            // LinkedIn sometimes uses different section layouts, so targeting <main> is safer
            const topCard = page.locator('main').first();
            
            let followButton = topCard.locator('button:has-text("Follow"), [role="button"]:has-text("Follow")').first();
            let isFollowVisible = await followButton.isVisible();
            
            let connectButton = topCard.locator('button:has-text("Connect"), [role="button"]:has-text("Connect"), [aria-label^="Invite"]').first();
            let isConnectVisible = await connectButton.isVisible();

            // If neither is visible, check inside the "More" menu
            if (!isConnectVisible && !isFollowVisible) {
                const moreButton = topCard.locator('button[aria-label="More actions"], button:has-text("More"), [role="button"]:has-text("More"), [aria-label^="More"]').first();
                if (await moreButton.isVisible()) {
                    console.log('[Connector] Clicking More actions button to find Follow/Connect...');
                    await moreButton.click();
                    await randomDelay(1000, 2000);
                    
                    const dropdown = page.locator('.artdeco-dropdown__content');
                    
                    // Prioritize Connect first in the dropdown
                    connectButton = dropdown.locator('text="Connect"').first();
                    if (!(await connectButton.isVisible())) {
                        connectButton = dropdown.locator('[aria-label^="Invite"]').first();
                    }
                    isConnectVisible = await connectButton.isVisible();

                    // If Connect is not in dropdown, look for Follow
                    if (!isConnectVisible) {
                        followButton = dropdown.locator('text="Follow"').first();
                        isFollowVisible = await followButton.isVisible();
                    }
                }
            }

            // Prioritize connecting if the Connect button was found
            if (isConnectVisible) {
                console.log('[Connector] Clicking Connect button...');
                await connectButton.click();
                await randomDelay(2000, 4000);

                const sendButton = page.locator('button:has-text("Send without a note"), button:has-text("Send now"), button[aria-label="Send now"], button:has-text("Send")');
                try {
                    await sendButton.first().waitFor({ state: 'visible', timeout: 8000 });
                    await sendButton.first().click();
                    await pool.query("UPDATE Leads SET status = 'connected' WHERE id = $1", [lead.lead_id]);
                    await pool.query("UPDATE Users SET daily_actions_count = daily_actions_count + 1 WHERE id = $1", [lead.user_id]);
                    console.log(`[Connector] Successfully sent connection request to ${lead.linkedin_url}`);
                } catch (timeout) {
                    console.log('[Connector] Send button not found in modal or modal did not appear.');
                    await pool.query("UPDATE Leads SET status = 'failed' WHERE id = $1", [lead.lead_id]);
                    await page.screenshot({ path: `debug_connector_modal_${lead.lead_id}.png` });
                }
            } else if (isFollowVisible) {
                // Fallback to Follow if Connect is not available
                console.log('[Connector] Connect button not found. Found Follow button. Clicking it...');
                await followButton.click();
                await randomDelay(1500, 3000);
                console.log('[Connector] Followed successfully.');
                await pool.query("UPDATE Leads SET status = 'connected' WHERE id = $1", [lead.lead_id]);
                await pool.query("UPDATE Users SET daily_actions_count = daily_actions_count + 1 WHERE id = $1", [lead.user_id]);
            } else {
                // If neither Connect nor Follow is visible anywhere, check if we are already connected/following
                const followingButton = topCard.locator('button:has-text("Following"), [role="button"]:has-text("Following")').first();
                const messageButton = topCard.locator('button:has-text("Message"), a:has-text("Message")').first();
                const pendingButton = topCard.locator('button:has-text("Pending"), [role="button"]:has-text("Pending")').first();
                
                if (await followingButton.isVisible() || await messageButton.isVisible() || await pendingButton.isVisible()) {
                    console.log('[Connector] Already following/connected (or pending) with this user. Marking as connected.');
                    await pool.query("UPDATE Leads SET status = 'connected' WHERE id = $1", [lead.lead_id]);
                } else {
                    console.log('[Connector] Connect/Follow button not found on profile. (Might already be connected or need more options)');
                    await pool.query("UPDATE Leads SET status = 'failed' WHERE id = $1", [lead.lead_id]);
                    await page.screenshot({ path: `debug_connector_modal_${lead.lead_id}.png` });
                }
            }
        } catch (err) {
            console.error('[Connector] Error interacting with profile:', err);
            await pool.query("UPDATE Leads SET status = 'failed' WHERE id = $1", [lead.lead_id]);
        }

        if (browser) await browser.close();

    } catch (error) {
        console.error('[Connector] Error:', error);
    } finally {
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
}

module.exports = { runConnector };
