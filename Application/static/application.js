import { PWA } from './lib/pwa.js';
import { Logger } from './lib/logger.js';

const config = {
  notificationTimeout: 3000,
};

class App extends PWA {
  constructor(opts) {
    super(opts);
    this.getElements();
    this.setupEventListeners();
    this.updateUI();
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
    this.sendBtn.onclick = () => this.sendMessage();
    this.messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.sendMessage();
    });
  }

  async sendMessage() {
    const content = this.messageInput?.value?.trim();
    this.messageInput.value = '';
    if (!content) {
      this.notification.showNotification('Please enter a message', 'warning');
      return;
    }
    this.postMessage({ type: 'message', content });
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

  showNotification(message, type = 'info') {
    const element = this.notification;
    element.textContent = message;
    element.className = `notification ${type}`;
    element.classList.remove('hidden');
    setTimeout(() => {
      element.classList.add('hidden');
    }, this.config.notificationTimeout || 3000);
  }

  updateUI() {
    this.sendMessageBtn.disabled = !this.online;
    this.updateConnectionStatus();
  }

  async updateCache() {
    this.logger.log('Requesting cache update...');
    this.postMessage({ type: 'updateCache' });
  }
}

const logger = Logger.fromId('output');
const app = new App({ config, logger });

app.on('error', ({ error }) => {
  logger.log('Service worker error:', error);
  app.showNotification('Service worker error', 'error');
});
app.on('installable', () => app.showInstallButton(true));
app.on('installed', (installed) => app.showInstallButton(installed));
app.on('status', ({ connected }) => {
  const status = connected ? 'connected' : 'disconnected';
  const message = `Service worker ${status}`;
  logger.log(message);
  app.showNotification(message, connected ? 'success' : 'warning');
  app.updateUI();
});
app.on('cacheUpdated', ({ error }) => {
  if (!error) {
    logger.log('Cache updated successfully');
    app.showNotification('Cache updated successfully', 'success');
  } else {
    logger.log('Cache update failed:', error);
    app.showNotification('Cache update failed', 'error');
  }
  app.updateCacheBtn.disabled = false;
});
app.on('message', ({ content }) => {
  logger.log('Message:', content);
  app.showNotification(`Message: ${content}`, 'info');
});

export { app };
