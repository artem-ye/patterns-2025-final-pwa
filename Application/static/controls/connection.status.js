import { AbstractControl } from '../lib/abstract.control.js';

class ConnectionStatus extends AbstractControl {
  setState(online) {
    const status = online ? 'online' : 'offline';
    this.element.textContent = status.toUpperCase();
    this.element.className = `status-indicator ${status}`;
  }
}

export { ConnectionStatus };
