import { AbstractControl } from '../lib/abstract.control.js';

class Logger extends AbstractControl {
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
