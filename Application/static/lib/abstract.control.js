class AbstractControl {
  constructor(element, opts = {}) {
    this.element = element;
    this.options = opts;
  }

  static createById(id, opts) {
    const el = document.getElementById(id);
    return new this(el, opts);
  }

  get disabled() {
    return this.element.disabled;
  }
  set disabled(value) {
    this.element.disabled = value;
  }

  get visible() {
    return this.element.classList.contains('hidden');
  }
  set visible(visible) {
    const clsName = 'hidden';
    if (visible) this.element.classList.remove(clsName);
    else this.element.classList.add(clsName);
  }

  on(event, listener) {
    this.element.addEventListener(event, listener);
  }
  off(event, listener) {
    this.element.removeEventListener(event, listener);
  }
}

export { AbstractControl };
