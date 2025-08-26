const generateId = () => Math.random().toString(36).substr(2, 9);

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

class PWA extends EventEmitter {
  config = {};
  logger = null;
  notification = null;
  #worker = null;
  #clientId = null;
  #online = true;
  #installer = null;

  constructor({ config, logger, notification }) {
    super();
    this.config = config;
    this.notification = notification;
    this.logger = logger || { log: () => {}, clear: () => {} };
    this.#initClientId();
    this.#initWorker();
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

    this.#worker.postMessage({ type: 'connect' });
    const ping = () => this.#worker.postMessage({ type: 'ping' });
    setInterval(ping, this.config.pingInterval);
    document.addEventListener('visibilitychange', ping);
  }

  #initClientId() {
    this.#clientId = localStorage.getItem('clientId');
    if (!this.#clientId) {
      this.#clientId = generateId();
      localStorage.setItem('clientId', this.#clientId);
    }
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

  async postMessage(content) {
    this.#worker.postMessage({ type: 'message', content });
    this.logger.log('Sent message:', content);
  }

  async updateCache() {
    this.logger.log('Requesting cache update...');
    this.#worker.postMessage({ type: 'updateCache' });
  }

  get online() {
    return this.#online;
  }
}

export { PWA };
