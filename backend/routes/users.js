const express = require('express');
const router = express.Router();
const pool = require('../db');

function validateUserId(id) {
    const num = Number(id);
    return Number.isInteger(num) && num > 0;
}

function sanitizeCookie(cookie) {
    if (typeof cookie !== 'string') return '';
    return cookie.trim().slice(0, 5000);
}

// Get all users
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, cookie_status, daily_actions_count FROM Users ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get user status
router.get('/:id', async (req, res) => {
    if (!validateUserId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    try {
        const result = await pool.query('SELECT id, name, cookie_status, daily_actions_count FROM Users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update user cookie or credentials
router.put('/:id/cookie', async (req, res) => {
    if (!validateUserId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    const { li_at_cookie, linkedin_email, linkedin_password } = req.body;
    
    if (!li_at_cookie && (!linkedin_email || !linkedin_password)) {
        return res.status(400).json({ error: 'Either li_at_cookie OR both email and password are required' });
    }

    if (li_at_cookie) {
        const sanitizedCookie = sanitizeCookie(li_at_cookie);
        if (sanitizedCookie.length < 10) {
            return res.status(400).json({ error: 'Invalid li_at_cookie format' });
        }
    }

    try {
        if (li_at_cookie) {
            await pool.query(
                "UPDATE Users SET li_at_cookie = $1, cookie_status = 'valid' WHERE id = $2",
                [sanitizeCookie(li_at_cookie), req.params.id]
            );
        } else {
            await pool.query(
                "UPDATE Users SET linkedin_email = $1, linkedin_password = $2, cookie_status = 'valid' WHERE id = $3",
                [linkedin_email, linkedin_password, req.params.id]
            );
        }
        res.json({ message: 'Credentials updated successfully.' });
    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
