import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logger = logging.getLogger(__name__)

class SecretManager:
    def __init__(self, browser):
        self.browser = browser
    
    def enable_secret_conversation(self, uid):
        """Enable secret conversation for a UID"""
        try:
            # Go to conversation
            self.browser.get(f"https://www.messenger.com/t/{uid}")
            time.sleep(3)
            
            # Click on options menu
            options_button = WebDriverWait(self.browser, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='More actions']"))
            )
            options_button.click()
            time.sleep(1)
            
            # Click "Go to secret conversation"
            secret_option = WebDriverWait(self.browser, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Go to secret conversation')]"))
            )
            secret_option.click()
            time.sleep(5)
            
            # Verify secret conversation
            secret_indicator = WebDriverWait(self.browser, 10).until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'end-to-end encryption')]"))
            )
            
            logger.info(f"Secret conversation enabled for UID: {uid}")
            return True
            
        except Exception as e:
            logger.error(f"Secret conversation error for {uid}: {e}")
            return False
    
    def is_secret_conversation(self):
        """Check if current conversation is secret"""
        try:
            secret_indicator = self.browser.find_elements(By.XPATH, "//*[contains(text(), 'end-to-end encryption')]")
            return len(secret_indicator) > 0
        except:
            return False
