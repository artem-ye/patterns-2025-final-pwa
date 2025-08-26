import { AbstractControl } from '../lib/abstract.control.js';

class Notification extends AbstractControl {
  #timeout = 0;

  constructor(el, opts) {
    super(el, opts);
    this.#timeout = opts.timeout ?? 0;
  }

  notify(message, type = 'info') {
    const el = this.element;
    el.textContent = message;
    el.className = `notification ${type}`;
    this.visible(true);
    setTimeout(() => this.visible(false), this.#timeout);
  }
}

export { Notification };
