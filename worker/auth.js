require('dotenv').config();
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(StealthPlugin);
const pool = require('./db');

async function runAutoLogin(userId) {
    console.log(`[Auth] Attempting auto-login for user ${userId}...`);
    
    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;
    
    if (!email || !password) {
        console.log(`[Auth] No credentials found in worker/.env file. Please add LINKEDIN_EMAIL and LINKEDIN_PASSWORD. Cannot auto-login.`);
        await pool.query("UPDATE Users SET cookie_status = 'invalid' WHERE id = $1", [userId]);
        return false;
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
        
        await page.fill('input[autocomplete="username"]:visible', email);
        await page.fill('input[autocomplete="current-password"]:visible', password);
        await page.press('input[autocomplete="current-password"]:visible', 'Enter');

        console.log(`[Auth] Submitted credentials. Waiting for feed to load (up to 3 minutes for manual captcha solving)...`);
        
        // Wait for feed URL, meaning successful login. 
        // 3 minute timeout to let user solve captcha.
        await page.waitForURL('**/feed/**', { timeout: 3 * 60 * 1000 });
        
        console.log(`[Auth] Successfully reached feed! Extracting fresh li_at cookie...`);
        const cookies = await context.cookies();
        const liAt = cookies.find(c => c.name === 'li_at');
        
        if (liAt) {
            await pool.query(
                "UPDATE Users SET li_at_cookie = $1, cookie_status = 'valid' WHERE id = $2",
                [liAt.value, userId]
            );
            console.log(`[Auth] Fresh li_at cookie saved for user ${userId}.`);
            await browser.close();
            return true;
        } else {
            throw new Error('li_at cookie not found after login');
        }
    } catch (err) {
        console.error(`[Auth] Auto-login failed or timed out:`, err.message);
        await pool.query("UPDATE Users SET cookie_status = 'invalid' WHERE id = $1", [userId]);
        await browser.close();
        return false;
    }
}

module.exports = { runAutoLogin };
