/**
 * ContextMenu - right-click context menus
 */

export class ContextMenu {
    constructor(store, renderer, callbacks = {}) {
        this.store = store;
        this.renderer = renderer;
        this.callbacks = callbacks;

        this.menu = null;
        this.currentTarget = null;

        this._createMenu();
        this._bindEvents();
    }

    _createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';
        this.menu.style.display = 'none';
        document.body.appendChild(this.menu);
    }

    _bindEvents() {
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            if (!this.menu.contains(e.target)) {
                // Will be handled by canvas
            }
        });
    }

    show(x, y, node, connection, worldPos) {
        this.menu.innerHTML = '';
        this.currentTarget = { node, connection, worldPos };

        if (node) {
            this._buildNodeMenu(node);
        } else if (connection) {
            this._buildConnectionMenu(connection);
        } else {
            this._buildCanvasMenu(worldPos);
        }

        // Position menu
        this.menu.style.display = 'block';
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;

        // Adjust if off-screen
        const rect = this.menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.menu.style.top = `${y - rect.height}px`;
        }
    }

    hide() {
        this.menu.style.display = 'none';
        this.currentTarget = null;
    }

    _buildNodeMenu(node) {
        this._addItem('content_copy', 'Duplicate', () => {
            const newNode = node.clone(node.x + 50, node.y + 50);
            this.store.nodes.set(newNode.id, newNode);
            this.store.clearSelection();
            this.store.selectNode(newNode.id, true);
            this.store.emit('change');
        });

        this._addDivider();

        this._addItem(node.collapsed ? 'expand_more' : 'expand_less',
            node.collapsed ? 'Expand' : 'Collapse', () => {
                node.toggleCollapsed();
                this.renderer.requestRender();
            });

        this._addDivider();

        this._addItem('link_off', 'Disconnect all', () => {
            const connections = [...this.store.getConnections().values()];
            connections.forEach(conn => {
                if (conn.involvesNode(node.id)) {
                    this.store.removeConnection(conn.id);
                }
            });
        });

        this._addDivider();

        this._addItem('delete', 'Delete', () => {
            this.store.removeNode(node.id);
            if (this.callbacks.onNotify) {
                this.callbacks.onNotify('Node deleted');
            }
        }, true);
    }

    _buildConnectionMenu(connection) {
        this._addItem('delete', 'Delete connection', () => {
            this.store.removeConnection(connection.id);
            if (this.callbacks.onNotify) {
                this.callbacks.onNotify('Connection removed');
            }
        }, true);
    }

    _buildCanvasMenu(worldPos) {
        this._addItem('add', 'Add Start node', () => {
            this.store.addNode('start', worldPos.x, worldPos.y);
        });

        this._addItem('add', 'Add End node', () => {
            this.store.addNode('end', worldPos.x, worldPos.y);
        });

        this._addDivider();

        this._addItem('select_all', 'Select all', () => {
            this.store.selectAll();
        });

        this._addDivider();

        this._addItem('fit_screen', 'Fit to content', () => {
            this.renderer.fitToContent(this.store.getNodes());
            const vp = this.renderer.viewport;
            this.store.setViewport(vp.panX, vp.panY, vp.zoom);
        });

        this._addItem('center_focus_strong', 'Reset view', () => {
            this.store.setViewport(100, 100, 1);
        });

        this._addDivider();

        this._addItem('delete_forever', 'Clear canvas', () => {
            if (confirm('Clear all nodes and connections?')) {
                this.store.clear();
                if (this.callbacks.onNotify) {
                    this.callbacks.onNotify('Canvas cleared');
                }
            }
        }, true);
    }

    _addItem(icon, label, action, danger = false) {
        const item = document.createElement('div');
        item.className = 'context-menu-item' + (danger ? ' danger' : '');

        const iconEl = document.createElement('span');
        iconEl.className = 'material-symbols-outlined';
        iconEl.textContent = icon;

        const labelEl = document.createElement('span');
        labelEl.textContent = label;

        item.appendChild(iconEl);
        item.appendChild(labelEl);

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            action();
            this.hide();
        });

        this.menu.appendChild(item);
    }

    _addDivider() {
        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        this.menu.appendChild(divider);
    }
}
