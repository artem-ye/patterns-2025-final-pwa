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

  static async requestPermission() {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
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
  #notifications = null;

  constructor({ config, logger, notification }) {
    super({ config, logger });
    this.getElements();
    this.setupNotifications(notification);
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

  async setupNotifications(instance) {
    if (!instance) return;
    this.#notifications = instance;
    const permission = await Notifications.requestPermission();
    this.logger.log('Notification permission:', permission);
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
      this.notify(message, connected ? 'success' : 'warning');
    });
    this.on('message', ({ content }) => {
      this.notify(`Message: ${content}`, 'info');
      this.logger.log('Message:', content);
    });
    this.on('error', ({ error }) => {
      this.logger.log('Service worker error:', error);
      this.notify('Service worker error', 'error');
    });
    // TODO: refactor
    this.on('cacheUpdated', () => {
      this.logger.log('Cache updated successfully');
      this.notify('Cache updated successfully!', 'success');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
    });
    this.on('cacheUpdateFailed', ({ error }) => {
      this.logger.log('Cache update failed:', error);
      this.notify('Cache update failed', 'error');
      this.updateCacheBtn.disabled = false;
      this.updateCacheBtn.textContent = 'Update Cache';
    });
  }

  async sendMessage() {
    const content = this.messageInput?.value?.trim();
    this.messageInput.value = '';
    if (!content) {
      this.notify('Please enter a message', 'warning');
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

  notify(message, type = 'info') {
    if (!this.#notifications) return;
    this.#notifications.notify(message, type);
  }
}

const logger = Logger.fromId('output');
const notification = Notifications.fromId('notification', {
  timeout: config.notificationTimeout,
});
const app = new App({ config, logger, notification });
app.on('message', (data) => logger.log('Message', data));

console.log(`\n\n\n!!! STARTING ${VERSION} !!!\n\n\n`);
