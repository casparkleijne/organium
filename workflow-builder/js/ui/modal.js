/**
 * Modal - custom dialog for alerts and confirmations
 */

export class Modal {
    constructor() {
        this._createOverlay();
    }

    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this._handleCancel();
            }
        });

        this.dialog = document.createElement('div');
        this.dialog.className = 'modal-dialog';

        this.overlay.appendChild(this.dialog);
    }

    /**
     * Show an alert dialog
     */
    alert(message, title = 'Notice') {
        return new Promise((resolve) => {
            this._resolveCallback = resolve;
            this._rejectCallback = null;

            this.dialog.innerHTML = `
                <div class="modal-header">
                    <span class="material-symbols-outlined">info</span>
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary modal-ok">OK</button>
                </div>
            `;

            this.dialog.querySelector('.modal-ok').addEventListener('click', () => {
                this._close();
                resolve();
            });

            this._show();
        });
    }

    /**
     * Show a confirmation dialog
     */
    confirm(message, title = 'Confirm', options = {}) {
        const {
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = false,
            icon = 'help'
        } = options;

        return new Promise((resolve) => {
            this._resolveCallback = () => resolve(true);
            this._rejectCallback = () => resolve(false);

            this.dialog.innerHTML = `
                <div class="modal-header">
                    <span class="material-symbols-outlined">${icon}</span>
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-text modal-cancel">${cancelText}</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${confirmText}</button>
                </div>
            `;

            this.dialog.querySelector('.modal-cancel').addEventListener('click', () => {
                this._handleCancel();
            });

            this.dialog.querySelector('.modal-confirm').addEventListener('click', () => {
                this._close();
                resolve(true);
            });

            this._show();
        });
    }

    /**
     * Show an error dialog
     */
    error(message, title = 'Error') {
        return new Promise((resolve) => {
            this._resolveCallback = resolve;
            this._rejectCallback = null;

            this.dialog.innerHTML = `
                <div class="modal-header modal-header-error">
                    <span class="material-symbols-outlined">error</span>
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary modal-ok">OK</button>
                </div>
            `;

            this.dialog.querySelector('.modal-ok').addEventListener('click', () => {
                this._close();
                resolve();
            });

            this._show();
        });
    }

    _show() {
        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
        });

        // Focus first button
        const firstBtn = this.dialog.querySelector('button');
        if (firstBtn) firstBtn.focus();

        // Handle escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                this._handleCancel();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    _close() {
        document.removeEventListener('keydown', this._escHandler);
        this.overlay.classList.remove('visible');
        setTimeout(() => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 200);
    }

    _handleCancel() {
        this._close();
        if (this._rejectCallback) {
            this._rejectCallback();
        } else if (this._resolveCallback) {
            this._resolveCallback();
        }
    }
}

// Singleton instance
export const modal = new Modal();
