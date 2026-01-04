/**
 * ValidationPanel - displays validation errors at the bottom of the canvas
 */

export class ValidationPanel {
    constructor(container, store, renderer) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;
        this.errors = [];

        this._createPanel();
        this._bindEvents();
    }

    _createPanel() {
        this.container.innerHTML = `
            <div class="validation-panel">
                <div class="validation-header">
                    <div class="validation-header-left">
                        <h3>Problems</h3>
                        <span class="validation-count">0</span>
                    </div>
                    <button class="validation-close" title="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="validation-list"></div>
            </div>
        `;

        this.countEl = this.container.querySelector('.validation-count');
        this.listEl = this.container.querySelector('.validation-list');
    }

    _bindEvents() {
        this.container.querySelector('.validation-close').addEventListener('click', () => {
            this.hide();
        });
    }

    show(errors) {
        this.errors = errors || [];

        if (this.errors.length === 0) {
            this.hide();
            return;
        }

        // Update count
        const errorCount = this.errors.filter(e => e.type === 'error').length;
        const warningCount = this.errors.filter(e => e.type === 'warning').length;

        if (errorCount > 0) {
            this.countEl.textContent = errorCount;
            this.countEl.classList.remove('warning');
        } else {
            this.countEl.textContent = warningCount;
            this.countEl.classList.add('warning');
        }

        // Render errors
        this.listEl.innerHTML = '';

        // Sort: errors first, then warnings
        const sorted = [...this.errors].sort((a, b) => {
            if (a.type === 'error' && b.type !== 'error') return -1;
            if (a.type !== 'error' && b.type === 'error') return 1;
            return 0;
        });

        sorted.forEach(error => {
            const item = document.createElement('div');
            item.className = `validation-item ${error.type}`;

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.textContent = error.type === 'error' ? 'error' : 'warning';

            const message = document.createElement('span');
            message.className = 'validation-message';
            message.textContent = error.message;

            item.appendChild(icon);
            item.appendChild(message);

            // Click to select the node
            if (error.nodeId) {
                item.addEventListener('click', () => {
                    this._selectNode(error.nodeId);
                });
            }

            this.listEl.appendChild(item);
        });

        this.container.classList.add('visible');
    }

    hide() {
        this.container.classList.remove('visible');
        this.errors = [];
    }

    _selectNode(nodeId) {
        const node = this.store.getNode(nodeId);
        if (!node) return;

        // Clear selection and select this node
        this.store.clearSelection();
        this.store.selectNode(nodeId, true);

        // Center view on node
        const bounds = node.getBounds();
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        const el = this.renderer.svg || this.renderer.canvas;
        const rect = el.getBoundingClientRect();
        const viewCenterX = rect.width / 2;
        const viewCenterY = rect.height / 2;

        const zoom = this.renderer.viewport.zoom;
        const panX = viewCenterX - centerX * zoom;
        const panY = viewCenterY - centerY * zoom;

        this.renderer.setViewport(panX, panY, zoom);
        this.store.setViewport(panX, panY, zoom);
    }

    isVisible() {
        return this.container.classList.contains('visible');
    }
}
