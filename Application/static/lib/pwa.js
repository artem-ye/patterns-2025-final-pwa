const generateId = () => Math.random().toString(36).substr(2, 9);

const getClientId = () => {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = generateId();
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
};

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, listener) {
    let listeners = this.events[eventName];
    if (!listeners) {
      listeners = [];
      this.events[eventName] = listeners;
    }
    listeners.push(listener);
    return this;
  }

  off(eventName, listener) {
    const listeners = this.events[eventName];
    if (!listeners) return this;
    if (listener) {
      this.events[eventName] = listeners.filter((l) => l !== listener);
    } else {
      delete this.events[eventName];
    }
    return this;
  }

  emit(eventName, ...args) {
    const listeners = this.events[eventName] || [];
    if (!listeners) return false;
    for (const listener of listeners) {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    }
    return true;
  }
}

const DEF_CONFIG = {
  workerPath: './worker.js',
  pingInterval: 25000,
};

class PWA extends EventEmitter {
  config = {};
  logger = null;
  #worker = null;
  #clientId = null;
  #online = true;
  #installer = null;
  #ready = null;

  constructor({ config, logger, getClientId: clientId }) {
    super();
    this.config = { ...DEF_CONFIG, ...config };
    this.logger = logger || { log: () => {}, clear: () => {} };
    this.#clientId = clientId ? clientId() : getClientId();

    this.#ready = this.#initWorker().then(() => true);
    this.#initStatus();
    this.#initInstaller();
  }

  async #initWorker() {
    navigator.serviceWorker.register(this.config.workerPath);
    const registration = await navigator.serviceWorker.ready;
    this.#worker = registration.active;

    navigator.serviceWorker.addEventListener('message', (event) => {
      this.emit(event.data.type, event.data);
    });
    window.addEventListener('beforeunload', () => {
      this.#worker.postMessage({ type: 'disconnect' });
    });

    const ping = () => this.#worker.postMessage({ type: 'ping' });
    setInterval(ping, this.config.pingInterval);
    document.addEventListener('visibilitychange', ping);
  }

  #initStatus() {
    this.#online = navigator.onLine;
    this.on('status', ({ connected }) => {
      this.#online = connected;
    });
  }

  #initInstaller() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.#installer = event;
      this.emit('installable');
    });
    window.addEventListener('appinstalled', () => {
      const installed = this.#installer === null;
      this.emit('installed', installed);
    });
  }

  async install() {
    if (!this.#installer) {
      this.logger.log('Install prompt not available');
      return;
    }
    this.#installer.prompt();
    const { outcome } = await this.#installer.userChoice;
    const message = outcome === 'accepted' ? 'accepted' : 'dismissed';
    if (message === 'accepted') this.#installer = null;
    this.logger.log(`Install prompt ${message}`);
  }

  async postMessage(data) {
    await this.#ready;
    this.#worker.postMessage(data);
    this.logger.log('Sent message:', data);
  }

  static async requestNotificationsPermissions() {
    return await Notification.requestPermission();
  }

  static notify(body, options = {}) {
    if (Notification.permission !== 'granted') {
      this.logger.log('Notification not shown. Request permission required');
      return;
    }
    const defaults = {
      title: 'PWA Application',
      icon: '/icon.svg',
      badge: '/icon.svg',
    };
    const { title, ...rest } = { ...defaults, ...options, body };
    const notification = new Notification(title, rest);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  get online() {
    return this.#online;
  }

  get clientId() {
    return this.#clientId;
  }
}

export { PWA };
