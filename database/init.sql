-- Users Table
CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    li_at_cookie TEXT NOT NULL,
    linkedin_email VARCHAR(255),
    linkedin_password TEXT,
    cookie_status VARCHAR(50) DEFAULT 'valid',
    daily_actions_count INT DEFAULT 0,
    last_action_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns Table
CREATE TABLE Campaigns (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    job_description_text TEXT NOT NULL,
    extracted_company VARCHAR(255),
    extracted_role VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, searching, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads Table
CREATE TABLE Leads (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL REFERENCES Campaigns(id) ON DELETE CASCADE,
    linkedin_url TEXT NOT NULL,
    name VARCHAR(255),
    job_title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, connected, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (campaign_id, linkedin_url)
);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_modtime BEFORE UPDATE ON Campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_modtime BEFORE UPDATE ON Leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
