require('dotenv').config();
const pool = require('./db');

async function seedMoreProfiles() {
    try {
        console.log('Fetching an active campaign...');
        
        // Find the most recently created campaign
        const campaignResult = await pool.query('SELECT id FROM Campaigns ORDER BY created_at DESC LIMIT 1');
        
        if (campaignResult.rows.length === 0) {
            console.log('No campaigns found. Please run node seed.js first.');
            return;
        }

        const campaignId = campaignResult.rows[0].id;
        console.log(`Found campaign ID: ${campaignId}. Adding 15 fake profiles...`);

        const leads = [
            ['https://www.linkedin.com/in/test-profile-10/', 'Sarah Jenkins', 'Lead Designer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-11/', 'Michael Chang', 'Product Manager', 'pending'],
            ['https://www.linkedin.com/in/test-profile-12/', 'Emma Watson', 'Data Scientist', 'pending'],
            ['https://www.linkedin.com/in/test-profile-13/', 'David Rodriguez', 'DevOps Engineer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-14/', 'Jessica Chen', 'UX Researcher', 'pending'],
            ['https://www.linkedin.com/in/test-profile-15/', 'James Wilson', 'Backend Developer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-16/', 'Olivia Taylor', 'Marketing Director', 'pending'],
            ['https://www.linkedin.com/in/test-profile-17/', 'William Brown', 'Sales Executive', 'pending'],
            ['https://www.linkedin.com/in/test-profile-18/', 'Sophia Davis', 'HR Manager', 'pending'],
            ['https://www.linkedin.com/in/test-profile-19/', 'Alexander White', 'Mobile Developer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-20/', 'Mia Martin', 'QA Automation Engineer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-21/', 'Ethan Thompson', 'Solutions Architect', 'pending'],
            ['https://www.linkedin.com/in/test-profile-22/', 'Isabella Garcia', 'Data Analyst', 'pending'],
            ['https://www.linkedin.com/in/test-profile-23/', 'Daniel Martinez', 'Security Engineer', 'pending'],
            ['https://www.linkedin.com/in/test-profile-24/', 'Ava Robinson', 'Content Strategist', 'pending']
        ];

        let insertedCount = 0;
        for (const lead of leads) {
            try {
                await pool.query(`
                    INSERT INTO Leads (campaign_id, linkedin_url, name, job_title, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (campaign_id, linkedin_url) DO NOTHING
                `, [campaignId, ...lead]);
                insertedCount++;
            } catch (err) {
                console.error(`Error inserting ${lead[1]}:`, err.message);
            }
        }

        console.log(`Successfully added ${insertedCount} new profiles to Campaign ${campaignId}!`);

    } catch (error) {
        console.error('Error seeding profiles:', error);
    } finally {
        await pool.end();
    }
}

seedMoreProfiles();
