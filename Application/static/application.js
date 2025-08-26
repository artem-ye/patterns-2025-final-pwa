import { PWA } from './lib/pwa.js';
import * as controls from './controls/index.js';
const { Button, Input, Logger, Notification, ConnectionStatus } = controls;

const config = {
  workerPath: './worker.js',
  notificationTimeout: 3000,
};

class App extends PWA {
  constructor(config) {
    super(config);
    this.getElements();
    this.setupEventListeners();
    this.updateUI();
  }

  getElements() {
    this.installBtn = Button.createById('install-btn');
    this.sendMessageBtn = Button.createById('send-message-btn');
    this.updateCacheBtn = Button.createById('update-cache-btn');
    this.clearBtn = Button.createById('clear-btn');
    this.sendBtn = Button.createById('send-btn');
    this.messageInput = Input.createById('message-input');
    this.installStatus = Button.createById('install-status');
    this.connectionStatus = ConnectionStatus.createById('connection-status');
    this.notification = Notification.createById('notification', {
      timeout: this.config.notificationTimeout,
    });
  }

  setupEventListeners() {
    this.installBtn.on('click', () => this.install());
    this.sendMessageBtn.on('click', () => this.sendMessage());
    this.updateCacheBtn.on('click', () => this.updateCache());
    this.clearBtn.on('click', () => this.logger.clear());
    this.sendBtn.on('click', () => this.sendMessage());
    this.messageInput.on('keypress', (event) => {
      if (event.key === 'Enter') this.sendMessage();
    });
  }

  async sendMessage() {
    const content = this.messageInput.value;
    if (!content) {
      return void this.showNotification('Please enter a message', 'warning');
    }
    this.postMessage({ type: 'message', content });
    this.messageInput.clear();
  }

  showInstallButton(visible) {
    this.installBtn.visible = visible;
    this.installStatus.visible = visible;
  }

  showNotification(message, type) {
    this.notification.notify(message, type);
  }

  updateUI() {
    this.sendMessageBtn.disabled = !this.online;
    this.updateConnectionStatus();
  }

  updateConnectionStatus() {
    this.connectionStatus.setState(this.online);
  }

  updateCache() {
    this.updateCacheBtn.disabled = true;
    this.postMessage({ type: 'updateCache' });
  }

  cacheUpdated() {
    this.updateCacheBtn.disabled = false;
  }
}

const logger = Logger.createById('output');
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
  app.cacheUpdated(error);
});
app.on('message', ({ content }) => {
  logger.log('Message:', content);
  app.showNotification(`Message: ${content}`, 'info');
});

export { app };
