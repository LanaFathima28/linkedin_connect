const express = require('express');
const router = express.Router();
const pool = require('../db');
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, 10000); // Max 10k chars
}

function validateJobDescription(text) {
    const sanitized = sanitizeInput(text);
    if (sanitized.length < 50) {
        return { valid: false, error: 'Job description must be at least 50 characters.' };
    }
    if (sanitized.length > 10000) {
        return { valid: false, error: 'Job description too long (max 10000 characters).' };
    }
    return { valid: true, sanitized };
}

router.post('/', async (req, res) => {
    const { user_id, job_description_text } = req.body;

    if (!user_id || !job_description_text) {
        return res.status(400).json({ error: 'user_id and job_description_text are required.' });
    }

    if (!Number.isInteger(Number(user_id))) {
        return res.status(400).json({ error: 'user_id must be a valid integer.' });
    }

    const validation = validateJobDescription(job_description_text);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        // Prepare prompt for Gemini
        const prompt = `
Extract the Company Name and the Target Role from the following job description.
Return ONLY a valid JSON object with the keys "Company_Name" and "Target_Role".
If you cannot find one of them, return null for that key.
Do NOT include markdown formatting like \`\`\`json. Only return the raw JSON object string.

Job Description:
${validation.sanitized}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const responseText = response.text.trim();
        
        let extractedData;
        try {
             // Sometimes LLMs still add markdown even if told not to
             const cleanJson = responseText.replace(/```json/i, '').replace(/```/g, '').trim();
             extractedData = JSON.parse(cleanJson);
        } catch (parseError) {
             console.error("Failed to parse LLM response as JSON:", responseText);
             return res.status(500).json({ error: 'Failed to extract data from Job Description.', raw_response: responseText });
        }

        const { Company_Name, Target_Role } = extractedData;

        // Insert into Campaigns table
        const insertQuery = `
            INSERT INTO Campaigns (user_id, job_description_text, extracted_company, extracted_role, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *;
        `;
        const values = [user_id, job_description_text, Company_Name, Target_Role];

        const result = await pool.query(insertQuery, values);
        
        res.status(201).json({
            message: 'Campaign created successfully.',
            campaign: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   (SELECT count(*) FROM Leads l WHERE l.campaign_id = c.id) as total_leads,
                   (SELECT count(*) FROM Leads l WHERE l.campaign_id = c.id AND l.status = 'connected') as connected_leads
            FROM Campaigns c
            ORDER BY c.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
