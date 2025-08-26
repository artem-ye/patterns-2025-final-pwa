import { PWA } from './lib/pwa.js';

const VERSION = '1.1.1';

const config = {
  workerPath: './worker.js',
  pingInterval: 25000,
  notificationTimeout: 3000,
};

class Logger {
  element = null;

  constructor(element) {
    this.element = element;
  }

  static fromId(elementId) {
    return new Logger(document.getElementById(elementId));
  }

  log(...args) {
    const lines = args.map(Logger.#serialize);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${lines.join(' ')}\n`;
    this.element.textContent += logEntry;
    this.element.scrollTop = this.element.scrollHeight;
  }

  clear() {
    this.element.textContent = '';
  }

  static #serialize(x) {
    return typeof x === 'object' ? JSON.stringify(x, null, 2) : x;
  }
}

class Notifications {
  element = null;
  timeout = 0;

  constructor(element, { timeout }) {
    this.element = element;
    this.timeout = timeout ?? 3000;

    const requestPermissions = async () => {
      await Notification.requestPermission();
      window.removeEventListener('load', requestPermissions);
    };
    window.addEventListener('load', requestPermissions);
  }

  static fromId(elementId, opts) {
    return new Notifications(document.getElementById(elementId), opts);
  }

  notify(message, type = 'info') {
    if (!this.element) return;
    this.element.textContent = message;
    this.element.className = `notification ${type}`;
    this.element.classList.remove('hidden');
    setTimeout(() => {
      this.element.classList.add('hidden');
    }, this.timeout);
  }

  static async testNotification() {
    const notification = new Notification('PWA Example', {
      body: 'This is a test notification from the PWA!',
      icon: '/icon.svg',
      badge: '/icon.svg',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

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
    //this.on('online', () => this.updateConnectionStatus());
    this.on('installable', () => this.showInstallButton(true));
    this.on('installed', (installed) => this.showInstallButton(installed));

    // ??? setupEventListeners - this.on('online')
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
    // TODO: refactor
    this.on('cacheUpdated', () => {
      this.logger.log('Cache updated successfully');
      this.notification.notify('Cache updated successfully!', 'success');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
    });
    this.on('cacheUpdateFailed', ({ error }) => {
      this.logger.log('Cache update failed:', error);
      this.notification.notify('Cache update failed', 'error');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
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

console.log(`\n\n\n!!! STARTING ${VERSION} !!!\n\n\n`);
