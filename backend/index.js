const express = require('express');
const cors = require('cors');
require('dotenv').config();

const webhookRoutes = require('./routes/webhook');
const githubRoutes = require('./routes/github');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'RevBot Review Platform API', status: 'ok', version: '1.0.0' });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
            api: 'operational',
            githubApp: process.env.GITHUB_APP_ID ? 'configured' : 'not configured'
        }
    });
});

app.use('/api', webhookRoutes);
app.use('/github', githubRoutes);
app.use('/webhook/github', webhookRoutes);

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
