require('dotenv').config();
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(StealthPlugin);
const { runAutoLogin } = require('./auth');
const pool = require('./db');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1) + min));
const HEADLESS = process.env.HEADLESS !== 'false';

async function runScraper() {
    console.log('[Scraper] Checking for pending campaigns...');
    try {
        const campaignRes = await pool.query(`
            SELECT c.id, c.user_id, c.extracted_company, c.extracted_role, u.li_at_cookie, u.cookie_status
            FROM Campaigns c
            JOIN Users u ON c.user_id = u.id
            WHERE c.status = 'pending' AND u.cookie_status = 'valid'
            LIMIT 1
        `);

        if (campaignRes.rows.length === 0) {
            return;
        }

        const campaign = campaignRes.rows[0];
        console.log(`[Scraper] Found pending campaign ID: ${campaign.id} targeting ${campaign.extracted_company} - ${campaign.extracted_role}`);

        // Update status to searching
        await pool.query("UPDATE Campaigns SET status = 'searching' WHERE id = $1", [campaign.id]);

        const browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext();
        await context.addCookies([
            {
                name: 'li_at',
                value: campaign.li_at_cookie,
                domain: '.linkedin.com',
                path: '/',
                secure: true,
                httpOnly: true
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
                console.error(`[Scraper] Invalid li_at cookie detected for user ${campaign.user_id}. Attempting auto-login...`);
                await browser.close();
                
                const loginSuccess = await runAutoLogin(campaign.user_id);
                if (loginSuccess) {
                    console.log(`[Scraper] Auto-login successful. Resuming scraper next cycle.`);
                } else {
                    console.log(`[Scraper] Auto-login failed. User must update credentials manually.`);
                    await pool.query("UPDATE Campaigns SET status = 'pending' WHERE id = $1", [campaign.id]);
                }
                return;
            }
            throw err;
        }
        
        // Construct search URL
        const role = campaign.extracted_role || '';
        const company = campaign.extracted_company && campaign.extracted_company !== 'null' ? campaign.extracted_company : '';
        
        // Combine role and company
        const keywordString = `${role} ${company}`.trim();
        const keyword = encodeURIComponent(keywordString);
        
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${keyword}`;
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await randomDelay(3000, 6000); // Random delay to mimic human

        // Simulate scrolling
        await page.evaluate(() => window.scrollBy(0, 500));
        // Scrape profiles (Robust tag-based selector to bypass class obfuscation)
        let profiles = await page.$$eval('a[href*="/in/"]', nodes => {
            const uniqueMap = new Map();
            nodes.forEach(n => {
                const url = n.href.split('?')[0];
                let name = n.innerText.trim().split('\n')[0];
                
                // Clean up the name
                if (name.includes('View')) name = name.split('View')[0].trim();
                
                // Filter out invalid links (like LinkedIn's own pages) or empty names
                if (name && url.length > 30 && !url.includes('/in/linkedin')) {
                    uniqueMap.set(url, { url, name, jobTitle: 'LinkedIn Member' });
                }
            });
            return Array.from(uniqueMap.values());
        });

        console.log(`[Scraper] Found ${profiles.length} connectable profiles.`);

        if (profiles.length === 0) {
            console.log('[Scraper] Debugging: 0 profiles found. Saving screenshot and HTML...');
            await page.screenshot({ path: 'debug_0_profiles.png' });
            const html = await page.content();
            const fs = require('fs');
            fs.writeFileSync('debug_0_profiles.html', html);
            console.log('[Scraper] Saved debug_0_profiles.png and debug_0_profiles.html in the worker folder.');
            await pool.query("UPDATE Campaigns SET status = 'failed' WHERE id = $1", [campaign.id]);
        } else {
            for (const profile of profiles) {
                try {
                    await pool.query(`
                        INSERT INTO Leads (campaign_id, linkedin_url, name, job_title, status)
                        VALUES ($1, $2, $3, $4, 'pending')
                        ON CONFLICT (campaign_id, linkedin_url) DO NOTHING
                    `, [campaign.id, profile.url, profile.name, profile.jobTitle]);
                } catch (err) {
                    console.error('[Scraper] Error inserting lead:', err);
                }
            }
            await pool.query("UPDATE Campaigns SET status = 'completed' WHERE id = $1", [campaign.id]);
        }
        
        console.log(`[Scraper] Campaign ID: ${campaign.id} completed.`);

    } catch (error) {
        console.error('[Scraper] Error:', error);
    } finally {
        if (typeof browser !== 'undefined' && browser !== null) {
            await browser.close().catch(console.error);
        }
    }
}

module.exports = { runScraper };
