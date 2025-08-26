import { AbstractControl } from '../lib/abstract.control.js';

class Input extends AbstractControl {
  get value() {
    return this.element.value.trim();
  }

  set value(value) {
    this.element.value = value;
  }

  clear() {
    this.element.value = '';
  }
}

export { Input };
