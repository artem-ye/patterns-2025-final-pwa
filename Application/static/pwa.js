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
  logger = null;
  #worker = null;
  #clientId = null;
  #online = true;
  #installer = null;

  constructor({ logger }) {
    super();
    this.logger = logger || { log: () => {}, clear: () => {} };
    this.#initClientId();
    this.#registerWorker().then(() => {
      this.#initWorker();
      this.#initNetworkStatus();
      this.#initInstaller();
    });
  }

  #registerWorker() {
    const { promise, resolve } = Promise.withResolvers();
    navigator.serviceWorker.register('./worker.js');
    navigator.serviceWorker.ready.then((registration) => {
      this.#worker = registration.active;
      resolve();
    });
    return promise;
  }

  #initWorker() {
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.logger.log('Message:', event.data);
      this.emit(event.data.type, event.data);
    });
    window.addEventListener('beforeunload', () => {
      this.#worker.postMessage({ type: 'disconnect' });
    });

    this.#worker.postMessage({ type: 'connect' });
    const ping = () => this.#worker.postMessage({ type: 'ping' });
    setInterval(ping, 25000);
    document.addEventListener('visibilitychange', ping);
  }

  #initClientId() {
    this.#clientId = localStorage.getItem('clientId');
    if (!this.#clientId) {
      this.#clientId = generateId();
      localStorage.setItem('clientId', this.#clientId);
    }
  }

  #initNetworkStatus() {
    this.#online = navigator.onLine;
    window.addEventListener('online', () => {
      this.#online = true;
      this.#worker.postMessage({ type: 'online' });
      //this.emit('online', true);
    });
    window.addEventListener('offline', () => {
      this.#online = false;
      this.#worker.postMessage({ type: 'offline' });
      //this.emit('online', false);
    });
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
    // This try does`nt works
    try {
      this.#worker.postMessage({ type: 'updateCache' });
      this.emit('cacheUpdated');
    } catch (error) {
      this.emit('cacheUpdateError', error);
    }
  }

  get online() {
    return this.#online;
  }
}

export { PWA };
