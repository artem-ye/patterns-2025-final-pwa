import { PWA } from './pwa.js';

const VERSION = '1.1.3';

class Logger {
  #output;

  constructor(outputId) {
    this.#output = document.getElementById(outputId);
  }

  log(...args) {
    const lines = args.map(Logger.#serialize);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${lines.join(' ')}\n`;
    this.#output.textContent += logEntry;
    this.#output.scrollTop = this.#output.scrollHeight;
  }

  clear() {
    this.#output.textContent = '';
  }

  static #serialize(x) {
    return typeof x === 'object' ? JSON.stringify(x, null, 2) : x;
  }
}

const config = {
  workerPath: './worker.js',
  pingInterval: 25000,
};

class App extends PWA {
  constructor({ config, logger }) {
    super({ config, logger });
    this.getElements();
    this.setupEventListeners();
    this.setupWorkerListeners();
    this.updateUI();
    setTimeout(() => {
      this.requestNotificationPermission();
    }, 2000);
  }

  getElements() {
    this.installBtn = document.getElementById('install-btn');
    this.sendMessageBtn = document.getElementById('send-message-btn');
    this.updateCacheBtn = document.getElementById('update-cache-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.sendBtn = document.getElementById('send-btn');
    this.messageInput = document.getElementById('message-input');
    this.connectionStatus = document.getElementById('connection-status');
    this.installStatus = document.getElementById('install-status');
    this.notification = document.getElementById('notification');
  }

  setupEventListeners() {
    this.installBtn.onclick = () => this.install();
    this.sendMessageBtn.onclick = () => this.sendMessage();
    this.updateCacheBtn.onclick = () => this.updateCache();
    this.clearBtn.onclick = () => this.logger.clear();
    this.sendBtn.onclick = () => {
      this.sendMessage();
    };
    this.messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.sendMessage();
    });

    //this.on('online', () => this.updateConnectionStatus());
    this.on('installable', () => this.showInstallButton(true));
    this.on('installed', (installed) => this.showInstallButton(installed));
  }

  setupWorkerListeners() {
    // ??? setupEventListeners - this.on('online')
    this.on('status', ({ connected }) => {
      this.updateUI();
      const status = connected ? 'connected' : 'disconnected';
      const message = `Service worker ${status}`;
      this.logger.log(message);
      this.showNotification(message, connected ? 'success' : 'warning');
    });
    this.on('message', ({ content }) => {
      this.showNotification(`Message: ${content}`, 'info');
      this.logger.log('Message:', content);
    });
    this.on('error', ({ error }) => {
      this.logger.log('Service worker error:', error);
      this.showNotification('Service worker error', 'error');
    });
    // TODO: refactor
    this.on('cacheUpdated', () => {
      this.logger.log('Cache updated successfully');
      this.showNotification('Cache updated successfully!', 'success');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
    });
    this.on('cacheUpdateFailed', ({ error }) => {
      this.logger.log('Cache update failed:', error);
      this.showNotification('Cache update failed', 'error');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
    });
  }

  async sendMessage() {
    const content = this.messageInput?.value?.trim();
    this.messageInput.value = '';
    if (!content) {
      this.showNotification('Please enter a message', 'warning');
      return;
    }
    this.postMessage(content);
  }

  updateConnectionStatus() {
    const status = this.online ? 'online' : 'offline';
    this.connectionStatus.textContent = status.toUpperCase();
    this.connectionStatus.className = `status-indicator ${status}`;
  }

  showInstallButton(visible) {
    if (visible) {
      this.installBtn.classList.remove('hidden');
      this.installStatus.classList.remove('hidden');
    } else {
      this.installBtn.classList.add('hidden');
      this.installStatus.classList.add('hidden');
    }
  }

  updateUI() {
    this.sendMessageBtn.disabled = !this.online;
    this.updateConnectionStatus();
  }

  // Notifications

  showNotification(message, type = 'info') {
    if (!this.notification) return;
    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;
    this.notification.classList.remove('hidden');
    setTimeout(() => {
      this.notification.classList.add('hidden');
    }, 3000);
  }

  async requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    this.logger.log('Notification permission:', permission);
    return permission === 'granted';
  }

  async sendTestNotification() {
    const notification = new Notification('PWA Example', {
      body: 'This is a test notification from the PWA!',
      icon: '/icon.svg',
      badge: '/icon.svg',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    this.logger.log('Test notification sent');
  }
}
const logger = new Logger('output');
window.application = new App({ config, logger });

console.log(`\n\n\n!!! STARTING ${VERSION} !!!\n\n\n`);
