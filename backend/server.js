require('dotenv').config();
const express = require('express');
const cors = require('cors');
const campaignsRouter = require('./routes/campaigns');
const usersRouter = require('./routes/users');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignsRouter);
app.use('/api/users', usersRouter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
