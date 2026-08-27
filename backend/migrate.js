require('dotenv').config();
const pool = require('./db');

async function migrate() {
    try {
        console.log('Running database migrations...');
        
        // Add last_action_date if it doesn't exist
        await pool.query(`
            ALTER TABLE Users 
            ADD COLUMN IF NOT EXISTS last_action_date DATE DEFAULT CURRENT_DATE;
        `);
        console.log('Added last_action_date column.');

        // Create updated_at trigger function
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        
        // Add triggers to all tables (Drop if exists first to be safe)
        const tables = ['Users', 'Campaigns', 'Leads'];
        for (const table of tables) {
            await pool.query(`DROP TRIGGER IF EXISTS update_${table.toLowerCase()}_modtime ON ${table};`);
            await pool.query(`
                CREATE TRIGGER update_${table.toLowerCase()}_modtime 
                BEFORE UPDATE ON ${table} 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
            `);
            console.log(`Added trigger to ${table}.`);
        }

        console.log('Migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
