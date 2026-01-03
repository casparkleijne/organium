/**
 * Snackbar - notification messages
 */

export class Snackbar {
    constructor() {
        this.container = null;
        this.timeout = null;
        this._create();
    }

    _create() {
        this.container = document.createElement('div');
        this.container.className = 'snackbar';
        document.body.appendChild(this.container);
    }

    show(message, duration = 3000) {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.container.textContent = message;
        this.container.classList.add('visible');

        this.timeout = setTimeout(() => {
            this.hide();
        }, duration);
    }

    hide() {
        this.container.classList.remove('visible');
        this.timeout = null;
    }
}
