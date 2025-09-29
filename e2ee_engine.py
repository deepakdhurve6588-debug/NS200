import os
import json
import time
import base64
import logging
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

logger = logging.getLogger(__name__)

class E2EEBotEngine:
    def __init__(self, bot_id):
        self.bot_id = bot_id
        self.browser = None
        self.page = None
        self.is_running = False
        self.status = {
            'state': 'idle',
            'progress': '',
            'current_uid': None,
            'messages_sent': 0,
            'total_uids': 0,
            'start_time': None,
            'encryption_status': 'not_initialized'
        }
    
    def generate_encryption_keys(self, password="facebook-bot-secret"):
        """Generate encryption keys for E2EE"""
        try:
            # Generate salt
            salt = os.urandom(16)
            
            # Generate key using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
            
            # Save keys
            keys_data = {
                'key': key.decode(),
                'salt': base64.b64encode(salt).decode(),
                'algorithm': 'AES-256',
                'created_at': time.time()
            }
            
            with open('config/encryption_keys.json', 'w') as f:
                json.dump(keys_data, f, indent=2)
            
            logger.info("Encryption keys generated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Key generation error: {e}")
            return False
    
    def load_encryption_keys(self):
        """Load encryption keys"""
        try:
            with open('config/encryption_keys.json', 'r') as f:
                keys_data = json.load(f)
            
            key = keys_data['key'].encode()
            salt = base64.b64decode(keys_data['salt'])
            
            self.fernet = Fernet(key)
            self.status['encryption_status'] = 'ready'
            return True
            
        except Exception as e:
            logger.error(f"Key loading error: {e}")
            self.status['encryption_status'] = 'error'
            return False
    
    def encrypt_message(self, message):
        """Encrypt message using AES"""
        try:
            if not hasattr(self, 'fernet'):
                if not self.load_encryption_keys():
                    return None
            
            encrypted = self.fernet.encrypt(message.encode())
            return base64.b64encode(encrypted).decode()
            
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            return None
    
    def decrypt_message(self, encrypted_message):
        """Decrypt message"""
        try:
            if not hasattr(self, 'fernet'):
                if not self.load_encryption_keys():
                    return None
            
            encrypted = base64.b64decode(encrypted_message)
            decrypted = self.fernet.decrypt(encrypted)
            return decrypted.decode()
            
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return None
    
    def setup_browser(self):
        """Setup Chrome browser for Render.com"""
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            service = Service(ChromeDriverManager().install())
            self.browser = webdriver.Chrome(service=service, options=chrome_options)
            
            logger.info("Browser setup completed")
            return True
            
        except Exception as e:
            logger.error(f"Browser setup failed: {e}")
            return False
    
    def login_with_appstate(self):
        """Login using AppState"""
        try:
            with open('config/appstate.json', 'r') as f:
                appstate = json.load(f)
            
            if not appstate:
                raise Exception("AppState is empty")
            
            # Load Facebook and set cookies
            self.browser.get("https://www.facebook.com")
            for cookie in appstate:
                self.browser.add_cookie(cookie)
            
            # Verify login
            self.browser.get("https://www.facebook.com/me")
            time.sleep(3)
            
            if "facebook.com/login" in self.browser.current_url:
                raise Exception("AppState login failed")
            
            logger.info("AppState login successful")
            return True
            
        except Exception as e:
            logger.error(f"AppState login error: {e}")
            return False
    
    def load_uids(self):
        """Load UIDs from file"""
        try:
            with open('config/uids.txt', 'r') as f:
                content = f.read()
            
            uids = []
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith('#'):
                    if ':' in line:
                        name, uid = line.split(':', 1)
                        uids.append({'name': name.strip(), 'uid': uid.strip()})
                    else:
                        uids.append({'name': f'User_{line}', 'uid': line})
            
            return uids
            
        except Exception as e:
            logger.error(f"UIDs loading error: {e}")
            return []
    
    def load_messages(self):
        """Load messages from file"""
        try:
            with open('config/messages.txt', 'r') as f:
                content = f.read()
            
            messages = [line.strip() for line in content.split('\n') if line.strip()]
            return messages
            
        except Exception as e:
            logger.error(f"Messages loading error: {e}")
            return []
    
    def send_encrypted_message(self, uid, message, enable_e2ee=True):
        """Send encrypted message to UID"""
        try:
            # Go to conversation
            self.browser.get(f"https://www.messenger.com/t/{uid}")
            time.sleep(3)
            
            # Prepare message
            if enable_e2ee:
                encrypted_msg = self.encrypt_message(message)
                if encrypted_msg:
                    final_message = f"🔐 {encrypted_msg}"
                    self.status['encryption_status'] = 'active'
                else:
                    final_message = f"⚠️ {message}"  # Fallback to plain text
                    self.status['encryption_status'] = 'error'
            else:
                final_message = message
            
            # Find message input and send
            message_input = WebDriverWait(self.browser, 10).until(
                EC.presence_of_element_located((By.XPATH, "//div[@aria-label='Message']"))
            )
            
            # Simulate typing
            message_input.click()
            for char in final_message:
                message_input.send_keys(char)
                time.sleep(0.05)  # Typing delay
            
            # Send message
            send_button = self.browser.find_element(By.XPATH, "//div[@aria-label='Press Enter to send']")
            send_button.click()
            
            time.sleep(1)
            return True
            
        except Exception as e:
            logger.error(f"Message sending error for {uid}: {e}")
            return False
    
    def run(self, config):
        """Main bot execution"""
        self.is_running = True
        self.status['state'] = 'starting'
        self.status['start_time'] = time.time()
        
        try:
            # Generate encryption keys if not exists
            if config.get('enable_e2ee', True):
                if not os.path.exists('config/encryption_keys.json'):
                    self.generate_encryption_keys()
                self.load_encryption_keys()
            
            # Setup browser
            self.status['progress'] = 'Setting up browser...'
            if not self.setup_browser():
                raise Exception("Browser setup failed")
            
            # Login
            self.status['progress'] = 'Logging in with AppState...'
            if not self.login_with_appstate():
                raise Exception("AppState login failed")
            
            # Load data
            self.status['progress'] = 'Loading UIDs and messages...'
            uids = self.load_uids()
            messages = self.load_messages()
            
            if not uids:
                raise Exception("No UIDs found")
            if not messages:
                raise Exception("No messages found")
            
            self.status['total_uids'] = len(uids)
            self.status['state'] = 'running'
            
            # Send messages
            for uid_index, uid_info in enumerate(uids):
                if not self.is_running:
                    break
                
                self.status['current_uid'] = uid_info['uid']
                self.status['progress'] = f'Processing {uid_info["name"]} ({uid_index + 1}/{len(uids)})'
                
                logger.info(f"Processing UID: {uid_info['uid']} ({uid_info['name']})")
                
                # Send each message
                for message_index, message in enumerate(messages):
                    if not self.is_running:
                        break
                    
                    self.status['progress'] = f'Sending message {message_index + 1}/{len(messages)} to {uid_info["name"]}'
                    
                    success = self.send_encrypted_message(
                        uid_info['uid'], 
                        message,
                        enable_e2ee=config.get('enable_e2ee', True)
                    )
                    
                    if success:
                        self.status['messages_sent'] += 1
                        logger.info(f"✅ Message sent to {uid_info['name']}")
                    
                    # Delay between messages
                    if message_index < len(messages) - 1:
                        delay = config.get('min_delay', 5) + (config.get('max_delay', 10) - config.get('min_delay', 5)) * (uid_index / len(uids))
                        time.sleep(delay)
                
                # Delay between UIDs
                if uid_index < len(uids) - 1 and self.is_running:
                    time.sleep(config.get('max_delay', 10))
            
            # Completion
            if self.is_running:
                self.status['state'] = 'completed'
                self.status['progress'] = f'Completed! Sent {self.status["messages_sent"]} messages to {len(uids)} UIDs'
            else:
                self.status['state'] = 'stopped'
                self.status['progress'] = 'Stopped by user'
            
        except Exception as e:
            self.status['state'] = 'error'
            self.status['progress'] = f'Error: {str(e)}'
            logger.error(f"Bot execution error: {e}")
        
        finally:
            if self.browser:
                self.browser.quit()
            self.is_running = False
    
    def stop(self):
        """Stop the bot"""
        self.is_running = False
        self.status['state'] = 'stopping'
    
    def get_status(self):
        """Get current bot status"""
        if self.status['start_time']:
            self.status['running_time'] = time.time() - self.status['start_time']
        return self.status
