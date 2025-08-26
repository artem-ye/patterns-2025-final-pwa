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

export { Logger };
