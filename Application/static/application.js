import { PWA } from './lib/pwa.js';
import { Logger, Notifications } from './lib/core.components.js';

const config = {
  workerPath: './worker.js',
  pingInterval: 25000,
  notificationTimeout: 3000,
};

class App extends PWA {
  constructor({ config, logger, notification }) {
    super({ config, logger, notification });
    this.getElements();
    this.setupEventListeners();
    this.setupWorkerListeners();
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

  setupWorkerListeners() {
    this.on('installable', () => this.showInstallButton(true));
    this.on('installed', (installed) => this.showInstallButton(installed));

    this.on('status', ({ connected }) => {
      this.updateUI();
      const status = connected ? 'connected' : 'disconnected';
      const message = `Service worker ${status}`;
      this.logger.log(message);
      this.notification.notify(message, connected ? 'success' : 'warning');
    });
    this.on('message', ({ content }) => {
      this.notification.notify(`Message: ${content}`, 'info');
      this.logger.log('Message:', content);
    });
    this.on('error', ({ error }) => {
      this.logger.log('Service worker error:', error);
      this.notification.notify('Service worker error', 'error');
    });
    this.on('cacheUpdated', ({ error }) => {
      if (!error) {
        this.logger.log('Cache updated successfully');
        this.notification.notify('Cache updated successfully', 'success');
      } else {
        this.logger.log('Cache update failed:', error);
        this.notification.notify('Cache update failed', 'error');
      }
      this.updateCacheBtn.disabled = false;
    });
  }

  async sendMessage() {
    const content = this.messageInput?.value?.trim();
    this.messageInput.value = '';
    if (!content) {
      this.notification.notify('Please enter a message', 'warning');
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
}

const logger = Logger.fromId('output');
const notification = Notifications.fromId('notification', {
  timeout: config.notificationTimeout,
});
const app = new App({ config, logger, notification });
app.on('message', (data) => logger.log('Message', data));
