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

export { Logger, Notifications };
