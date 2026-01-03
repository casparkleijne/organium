/**
 * SettingsPanel - canvas settings in left sidebar
 */
import { modal } from './modal.js';

export class SettingsPanel {
    constructor(container, store, renderer, callbacks = {}) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;
        this.callbacks = callbacks;

        this.render();
    }

    render() {
        const settings = this.store.getSettings();

        this.container.innerHTML = `
            <div class="settings-section">
                <div class="settings-header">
                    <span>Settings</span>
                    <span class="material-symbols-outlined collapse-icon">expand_more</span>
                </div>
                <div class="settings-content">
                    <div class="setting-item">
                        <label for="showGrid">Show grid</label>
                        <div class="toggle-wrapper">
                            <input type="checkbox" id="showGrid" ${settings.showGrid ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </div>
                    </div>

                    <div class="setting-item">
                        <label for="snapToGrid">Snap to grid</label>
                        <div class="toggle-wrapper">
                            <input type="checkbox" id="snapToGrid" ${settings.snapToGrid ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </div>
                    </div>

                    <div class="setting-item">
                        <label for="gridSize">Grid size</label>
                        <input type="range" id="gridSize" min="10" max="50" step="5" value="${settings.gridSize}">
                        <span class="setting-value">${settings.gridSize}px</span>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-header">
                    <span>Actions</span>
                    <span class="material-symbols-outlined collapse-icon">expand_more</span>
                </div>
                <div class="settings-content">
                    <div class="settings-actions">
                        <button class="btn btn-outlined" id="newBtn">
                            <span class="material-symbols-outlined">add</span>
                            New
                        </button>
                        <button class="btn btn-outlined" id="exportBtn">
                            <span class="material-symbols-outlined">download</span>
                            Export
                        </button>
                        <button class="btn btn-outlined" id="importBtn">
                            <span class="material-symbols-outlined">upload</span>
                            Import
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add collapse handlers
        this.container.querySelectorAll('.settings-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });

        this._bindEvents();
    }

    _bindEvents() {
        // Grid toggle
        this.container.querySelector('#showGrid').addEventListener('change', (e) => {
            this.store.setSetting('showGrid', e.target.checked);
            this.renderer.setGridSettings(e.target.checked, this.store.getSettings().gridSize);
        });

        // Snap toggle
        this.container.querySelector('#snapToGrid').addEventListener('change', (e) => {
            this.store.setSetting('snapToGrid', e.target.checked);
        });

        // Grid size
        const gridSlider = this.container.querySelector('#gridSize');
        const gridValue = this.container.querySelector('.setting-value');
        gridSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            gridValue.textContent = `${size}px`;
            this.store.setSetting('gridSize', size);
            this.renderer.setGridSettings(this.store.getSettings().showGrid, size);
        });

        // New
        this.container.querySelector('#newBtn').addEventListener('click', async () => {
            const confirmed = await modal.confirm(
                'Create new workflow? Unsaved changes will be lost.',
                'New Workflow',
                { icon: 'note_add', danger: true, confirmText: 'Create New' }
            );
            if (confirmed) {
                this._createNewWorkflow();
                if (this.callbacks.onNotify) {
                    this.callbacks.onNotify('New workflow created');
                }
            }
        });

        // Export
        this.container.querySelector('#exportBtn').addEventListener('click', () => {
            const data = this.store.serialize();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'workflow.json';
            a.click();

            URL.revokeObjectURL(url);

            if (this.callbacks.onNotify) {
                this.callbacks.onNotify('Workflow exported');
            }
        });

        // Import
        this.container.querySelector('#importBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        this.store.deserialize(data);
                        if (this.callbacks.onNotify) {
                            this.callbacks.onNotify('Workflow imported');
                        }
                    } catch (err) {
                        modal.error('Failed to import workflow: ' + err.message, 'Import Error');
                    }
                };
                reader.readAsText(file);
            });

            input.click();
        });
    }

    _createNewWorkflow() {
        // Clear existing workflow
        this.store.clear();

        // Get canvas center position
        const container = this.renderer.container;
        const rect = container.getBoundingClientRect();
        const vp = this.renderer.viewport;

        // Calculate center in world coordinates
        const centerX = (rect.width / 2 - vp.panX) / vp.zoom;
        const centerY = (rect.height / 2 - vp.panY) / vp.zoom;

        // Create start node (above center)
        const startNode = this.store.addNode('start', centerX - 28, centerY - 100);

        // Create end node (below center)
        const endNode = this.store.addNode('end', centerX - 28, centerY + 50);

        // Connect them
        this.store.addConnection(startNode.id, 'output', endNode.id, 'input');

        // Fit to content
        setTimeout(() => {
            this.renderer.fitToContent(this.store.getNodes(), 150);
            const newVp = this.renderer.viewport;
            this.store.setViewport(newVp.panX, newVp.panY, newVp.zoom);
        }, 50);
    }
}
