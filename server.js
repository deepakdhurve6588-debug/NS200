from flask import Flask, render_template, request, jsonify, send_file
import os
import json
import time
import threading
import logging
from e2ee_engine import E2EEBotEngine
from secret_manager import SecretManager

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BotManager:
    def __init__(self):
        self.active_bots = {}
        self.bot_id_counter = 0
    
    def start_bot(self, config):
        bot_id = self.bot_id_counter
        self.bot_id_counter += 1
        
        bot_engine = E2EEBotEngine(bot_id)
        thread = threading.Thread(target=bot_engine.run, args=(config,))
        thread.daemon = True
        thread.start()
        
        self.active_bots[bot_id] = {
            'engine': bot_engine,
            'thread': thread,
            'started_at': time.time(),
            'config': config
        }
        
        return bot_id
    
    def get_bot_status(self, bot_id):
        if bot_id in self.active_bots:
            bot = self.active_bots[bot_id]
            return bot['engine'].get_status()
        return None
    
    def stop_bot(self, bot_id):
        if bot_id in self.active_bots:
            bot = self.active_bots[bot_id]
            bot['engine'].stop()
            return True
        return False

bot_manager = BotManager()

def ensure_directories():
    """Ensure required directories exist"""
    directories = ['config', 'templates', 'logs']
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            logger.info(f"Created directory: {directory}")

def check_appstate():
    """Check if AppState is configured"""
    appstate_path = 'config/appstate.json'
    if os.path.exists(appstate_path):
        try:
            with open(appstate_path, 'r') as f:
                appstate = json.load(f)
                return len(appstate) > 0
        except:
            return False
    return False

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "service": "e2ee-bot",
        "version": "2.0.0",
        "environment": "render"
    })

@app.route('/api/status')
def api_status():
    appstate_configured = check_appstate()
    
    # Check if encryption keys exist
    keys_path = 'config/encryption_keys.json'
    keys_configured = os.path.exists(keys_path)
    
    return jsonify({
        "success": True,
        "status": "running",
        "appstate_configured": appstate_configured,
        "encryption_ready": keys_configured,
        "active_bots": len(bot_manager.active_bots),
        "features": {
            "e2ee": True,
            "secret_conversations": True,
            "file_encryption": True,
            "batch_messaging": True
        }
    })

@app.route('/api/upload-appstate', methods=['POST'])
def upload_appstate():
    try:
        data = request.get_json()
        appstate_data = data.get('appstate')
        
        if not appstate_data:
            return jsonify({"success": False, "error": "No AppState data provided"})
        
        with open('config/appstate.json', 'w') as f:
            json.dump(appstate_data, f, indent=2)
        
        logger.info("AppState uploaded successfully")
        return jsonify({"success": True, "message": "AppState uploaded successfully"})
        
    except Exception as e:
        logger.error(f"AppState upload error: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/update-uids', methods=['POST'])
def update_uids():
    try:
        data = request.get_json()
        uids_data = data.get('uids', '')
        
        with open('config/uids.txt', 'w') as f:
            f.write(uids_data)
        
        # Count UIDs
        uids_count = len([line for line in uids_data.split('\n') if line.strip() and not line.startswith('#')])
        
        logger.info(f"UIDs updated: {uids_count} UIDs")
        return jsonify({"success": True, "message": f"Updated {uids_count} UIDs"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/update-messages', methods=['POST'])
def update_messages():
    try:
        data = request.get_json()
        messages_data = data.get('messages', '')
        
        with open('config/messages.txt', 'w') as f:
            f.write(messages_data)
        
        # Count messages
        messages_count = len([line for line in messages_data.split('\n') if line.strip()])
        
        logger.info(f"Messages updated: {messages_count} messages")
        return jsonify({"success": True, "message": f"Updated {messages_count} messages"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/generate-keys', methods=['POST'])
def generate_keys():
    try:
        bot_engine = E2EEBotEngine(0)  # Temporary instance for key generation
        success = bot_engine.generate_encryption_keys()
        
        if success:
            return jsonify({
                "success": True, 
                "message": "Encryption keys generated successfully",
                "e2ee_enabled": True
            })
        else:
            return jsonify({"success": False, "error": "Failed to generate encryption keys"})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/start-bot', methods=['POST'])
def start_bot():
    try:
        data = request.get_json() or {}
        
        # Configuration
        config = {
            'min_delay': data.get('min_delay', 5),
            'max_delay': data.get('max_delay', 10),
            'enable_e2ee': data.get('enable_e2ee', True),
            'enable_secret': data.get('enable_secret', True),
            'encryption_method': data.get('encryption_method', 'aes')
        }
        
        # Start bot
        bot_id = bot_manager.start_bot(config)
        
        return jsonify({
            "success": True,
            "message": "E2EE Bot started successfully",
            "bot_id": bot_id,
            "status_url": f"/api/bot-status/{bot_id}",
            "features_enabled": {
                "e2ee": config['enable_e2ee'],
                "secret_conversations": config['enable_secret']
            }
        })
        
    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/bot-status/<int:bot_id>')
def bot_status(bot_id):
    status = bot_manager.get_bot_status(bot_id)
    if status:
        return jsonify({"success": True, "status": status})
    else:
        return jsonify({"success": False, "error": "Bot not found"})

@app.route('/api/stop-bot/<int:bot_id>', methods=['POST'])
def stop_bot(bot_id):
    success = bot_manager.stop_bot(bot_id)
    if success:
        return jsonify({"success": True, "message": "Bot stopped successfully"})
    else:
        return jsonify({"success": False, "error": "Bot not found"})

@app.route('/api/files')
def get_files():
    try:
        files_info = {}
        
        # AppState file
        if os.path.exists('config/appstate.json'):
            with open('config/appstate.json', 'r') as f:
                appstate = json.load(f)
                files_info['appstate'] = {
                    'exists': True,
                    'cookies': len(appstate),
                    'valid': len(appstate) > 0
                }
        else:
            files_info['appstate'] = {'exists': False}
        
        # UIDs file
        if os.path.exists('config/uids.txt'):
            with open('config/uids.txt', 'r') as f:
                uids = f.read()
                uids_count = len([line for line in uids.split('\n') if line.strip() and not line.startswith('#')])
                files_info['uids'] = {
                    'exists': True,
                    'count': uids_count
                }
        else:
            files_info['uids'] = {'exists': False}
        
        # Messages file
        if os.path.exists('config/messages.txt'):
            with open('config/messages.txt', 'r') as f:
                messages = f.read()
                messages_count = len([line for line in messages.split('\n') if line.strip()])
                files_info['messages'] = {
                    'exists': True,
                    'count': messages_count
                }
        else:
            files_info['messages'] = {'exists': False}
        
        # Encryption keys
        files_info['encryption_keys'] = {
            'exists': os.path.exists('config/encryption_keys.json')
        }
        
        return jsonify({"success": True, "files": files_info})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    ensure_directories()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
