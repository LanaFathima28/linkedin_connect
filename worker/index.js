require('dotenv').config();
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(StealthPlugin);

const { runScraper } = require('./scraper');
const { runConnector } = require('./connector');

const SCRAPER_INTERVAL = parseInt(process.env.SCRAPER_INTERVAL || '30000', 10);
const CONNECTOR_MIN_INTERVAL = parseInt(process.env.CONNECTOR_MIN_INTERVAL || '20000', 10);
const CONNECTOR_MAX_INTERVAL = parseInt(process.env.CONNECTOR_MAX_INTERVAL || '40000', 10);
const HEADLESS = process.env.HEADLESS !== 'false';



let isWorking = false;
let isShuttingDown = false;

function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

async function scraperLoop() {
    if (isShuttingDown) return;
    
    if (!isWorking) {
        isWorking = true;
        try {
            await runScraper();
        } catch (error) {
            console.error('[Scraper Loop] Unexpected error:', error);
        } finally {
            isWorking = false;
        }
    }
    setTimeout(scraperLoop, SCRAPER_INTERVAL);
}

async function connectorLoop() {
    if (isShuttingDown) return;
    
    if (!isWorking) {
        isWorking = true;
        try {
            await runConnector();
        } catch (error) {
            console.error('[Connector Loop] Unexpected error:', error);
        } finally {
            isWorking = false;
        }
    }
    setTimeout(connectorLoop, getRandomInterval(CONNECTOR_MIN_INTERVAL / 1000, CONNECTOR_MAX_INTERVAL / 1000));
}

async function shutdown() {
    console.log('Shutting down worker...');
    isShuttingDown = true;
    
    // Wait for current operations to complete (max 30 seconds)
    const startTime = Date.now();
    while (isWorking && Date.now() - startTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Worker shutdown complete');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function startWorker() {
    console.log('Starting Playwright Worker...');
    setTimeout(scraperLoop, 0);
    setTimeout(connectorLoop, 15000);
}

startWorker();
