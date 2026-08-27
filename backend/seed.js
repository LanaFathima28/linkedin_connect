require('dotenv').config();
const pool = require('./db');

async function seed() {
    try {
        console.log('Seeding fake data...');

        // 1. Insert fake user
        const userResult = await pool.query(`
            INSERT INTO Users (name, li_at_cookie, linkedin_email, linkedin_password)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `, ['Test User', 'fake_cookie_123', 'test@example.com', 'fakepassword']);
        const userId = userResult.rows[0].id;
        console.log(`Created fake User with ID: ${userId}`);

        // 2. Insert fake campaign
        const campaignResult = await pool.query(`
            INSERT INTO Campaigns (user_id, job_description_text, extracted_company, extracted_role, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
        `, [userId, 'Looking for a Software Engineer at TechCorp.', 'TechCorp', 'Software Engineer', 'searching']);
        const campaignId = campaignResult.rows[0].id;
        console.log(`Created fake Campaign with ID: ${campaignId}`);

        // 3. Insert fake leads (profiles)
        await pool.query(`
            INSERT INTO Leads (campaign_id, linkedin_url, name, job_title, status)
            VALUES 
            ($1, $2, $3, $4, $5),
            ($1, $6, $7, $8, $9);
        `, [
            campaignId, 
            'https://www.linkedin.com/in/fake-profile-1/', 'Alice Smith', 'Senior Software Engineer', 'pending',
            'https://www.linkedin.com/in/fake-profile-2/', 'Bob Jones', 'Frontend Developer', 'connected'
        ]);
        console.log('Created fake Leads (LinkedIn profiles).');

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        await pool.end();
    }
}

seed();
