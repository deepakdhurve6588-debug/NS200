const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 Facebook Bot Starting...');

// Store bot status
let botStatus = {
    running: false,
    progress: 'Not started',
    currentUid: null,
    messagesSent: 0,
    totalUids: 0
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'running', 
        botStatus: botStatus,
        timestamp: new Date().toISOString()
    });
});

// File management APIs
app.get('/api/check-files', (req, res) => {
    const files = {
        appstate: fs.existsSync('appstate.json'),
        uids: fs.existsSync('uids.txt'),
        messages: fs.existsSync('messages.txt')
    };
    res.json({ success: true, files });
});

app.post('/api/save-appstate', (req, res) => {
    try {
        const { appstate } = req.body;
        fs.writeFileSync('appstate.json', JSON.stringify(appstate, null, 2));
        res.json({ success: true, message: 'AppState saved' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/save-uids', (req, res) => {
    try {
        const { uids } = req.body;
        fs.writeFileSync('uids.txt', uids);
        res.json({ success: true, message: 'UIDs saved' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/save-messages', (req, res) => {
    try {
        const { messages } = req.body;
        fs.writeFileSync('messages.txt', messages);
        res.json({ success: true, message: 'Messages saved' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Bot control APIs
app.post('/api/start-bot', (req, res) => {
    if (botStatus.running) {
        return res.json({ success: false, error: 'Bot is already running' });
    }

    // Start bot in background
    startBotProcess();
    
    res.json({ 
        success: true, 
        message: 'Bot started successfully',
        status: botStatus
    });
});

app.post('/api/stop-bot', (req, res) => {
    botStatus.running = false;
    botStatus.progress = 'Stopped by user';
    
    res.json({ 
        success: true, 
        message: 'Bot stopped',
        status: botStatus
    });
});

app.get('/api/bot-status', (req, res) => {
    res.json({ success: true, status: botStatus });
});

// Bot process simulation (Replace with actual puppeteer code later)
function startBotProcess() {
    botStatus.running = true;
    botStatus.progress = 'Starting...';
    botStatus.messagesSent = 0;
    
    console.log('🤖 Starting bot process...');
    
    // Read files
    try {
        const uids = fs.readFileSync('uids.txt', 'utf8').split('\n').filter(line => line.trim());
        const messages = fs.readFileSync('messages.txt', 'utf8').split('\n').filter(line => line.trim());
        
        botStatus.totalUids = uids.length;
        botStatus.progress = `Processing ${uids.length} UIDs with ${messages.length} messages`;
        
        console.log(`📨 Will send ${messages.length} messages to ${uids.length} UIDs`);
        
        // Simulate bot working
        simulateBotWorking(uids, messages);
        
    } catch (error) {
        botStatus.running = false;
        botStatus.progress = `Error: ${error.message}`;
        console.error('Bot error:', error);
    }
}

function simulateBotWorking(uids, messages) {
    let currentUidIndex = 0;
    
    const processNextUid = () => {
        if (!botStatus.running || currentUidIndex >= uids.length) {
            botStatus.running = false;
            botStatus.progress = 'Completed';
            console.log('✅ Bot process completed');
            return;
        }
        
        const uid = uids[currentUidIndex].trim();
        botStatus.currentUid = uid;
        botStatus.progress = `Sending messages to UID: ${uid} (${currentUidIndex + 1}/${uids.length})`;
        
        console.log(`📤 Processing UID: ${uid}`);
        
        // Simulate sending messages with delay
        let messageIndex = 0;
        
        const sendNextMessage = () => {
            if (!botStatus.running || messageIndex >= messages.length) {
                currentUidIndex++;
                setTimeout(processNextUid, 2000); // Delay between UIDs
                return;
            }
            
            const message = messages[messageIndex].trim();
            console.log(`💬 Sending: "${message}" to ${uid}`);
            
            botStatus.messagesSent++;
            messageIndex++;
            
            // Simulate delay between messages (3-6 seconds)
            const delay = 3000 + Math.random() * 3000;
            setTimeout(sendNextMessage, delay);
        };
        
        sendNextMessage();
    };
    
    processNextUid();
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`🤖 Bot Control: http://localhost:${PORT}/api/start-bot`);
});
