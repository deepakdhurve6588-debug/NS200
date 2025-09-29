const express = require('express');

const fs = require('fs');

const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware

app.use(express.json());

app.use(express.static('public'));

console.log('🚀 Simple Facebook Bot Starting...');

// Routes

app.get('/', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

app.get('/health', (req, res) => {

    res.json({ 

        status: 'running', 

        message: 'Bot server is working',

        timestamp: new Date().toISOString()

    });

});

// API to check files

app.get('/api/check-files', (req, res) => {

    const files = {

        appstate: fs.existsSync('appstate.json'),

        uids: fs.existsSync('uids.txt'),

        messages: fs.existsSync('messages.txt')

    };

    res.json({ success: true, files });

});

// API to save appstate

app.post('/api/save-appstate', (req, res) => {

    try {

        const { appstate } = req.body;

        fs.writeFileSync('appstate.json', JSON.stringify(appstate, null, 2));

        res.json({ success: true, message: 'AppState saved' });

    } catch (error) {

        res.json({ success: false, error: error.message });

    }

});

// API to save uids

app.post('/api/save-uids', (req, res) => {

    try {

        const { uids } = req.body;

        fs.writeFileSync('uids.txt', uids);

        res.json({ success: true, message: 'UIDs saved' });

    } catch (error) {

        res.json({ success: false, error: error.message });

    }

});

// API to save messages

app.post('/api/save-messages', (req, res) => {

    try {

        const { messages } = req.body;

        fs.writeFileSync('messages.txt', messages);

        res.json({ success: true, message: 'Messages saved' });

    } catch (error) {

        res.json({ success: false, error: error.message });

    }

});

// Start server

app.listen(PORT, '0.0.0.0', () => {

    console.log(`✅ Server running on port ${PORT}`);

    console.log(`🌐 Open: http://localhost:${PORT}`);

});