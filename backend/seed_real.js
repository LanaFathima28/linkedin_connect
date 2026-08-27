require('dotenv').config();
const pool = require('./db');

async function seedRealProfile() {
    try {
        console.log('Fetching an active campaign...');
        
        // Find the most recently created campaign
        const campaignResult = await pool.query('SELECT id FROM Campaigns ORDER BY created_at DESC LIMIT 1');
        
        if (campaignResult.rows.length === 0) {
            console.log('No campaigns found. Please run node seed.js first.');
            return;
        }

        const campaignId = campaignResult.rows[0].id;
        console.log(`Found campaign ID: ${campaignId}. Adding real globally known profiles...`);

        // Removing the fake profiles we added earlier that are still pending
        await pool.query("DELETE FROM Leads WHERE campaign_id = $1 AND linkedin_url LIKE '%test-profile%' AND status = 'pending'", [campaignId]);

        const leads = [
            ['https://www.linkedin.com/in/williamhgates/', 'Bill Gates', 'Co-chair, Bill & Melinda Gates Foundation', 'pending'],
            ['https://www.linkedin.com/in/satyanadella/', 'Satya Nadella', 'Chairman and CEO at Microsoft', 'pending'],
            ['https://www.linkedin.com/in/sundarpichai/', 'Sundar Pichai', 'CEO at Google and Alphabet', 'pending']
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

        console.log(`Successfully added ${insertedCount} real profiles to Campaign ${campaignId}!`);

    } catch (error) {
        console.error('Error seeding profiles:', error);
    } finally {
        await pool.end();
    }
}

seedRealProfile();
