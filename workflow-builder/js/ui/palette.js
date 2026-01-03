/**
 * Palette - node palette in left sidebar
 */
import { NodeRegistry } from '../core/registry.js';

export class Palette {
    constructor(container, store, renderer) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;

        this.draggedType = null;
        this.dragGhost = null;

        this.render();
        this._bindEvents();
    }

    render() {
        this.container.innerHTML = '';

        const categories = NodeRegistry.getCategoriesWithNodes();

        categories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'palette-section';

            const header = document.createElement('div');
            header.className = 'palette-section-header';
            header.textContent = category.name;
            section.appendChild(header);

            const items = document.createElement('div');
            items.className = 'palette-items';

            category.nodes.forEach(NodeClass => {
                const item = this._createPaletteItem(NodeClass);
                items.appendChild(item);
            });

            section.appendChild(items);
            this.container.appendChild(section);
        });
    }

    _createPaletteItem(NodeClass) {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.draggable = true;
        item.dataset.type = NodeClass.type;

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'palette-item-icon';
        iconWrapper.style.backgroundColor = NodeClass.color;

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = NodeClass.icon;
        iconWrapper.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'palette-item-label';
        label.textContent = NodeClass.displayName;

        item.appendChild(iconWrapper);
        item.appendChild(label);

        return item;
    }

    _bindEvents() {
        this.container.addEventListener('dragstart', this._onDragStart.bind(this));
        this.container.addEventListener('dragend', this._onDragEnd.bind(this));

        // Drop on canvas/svg
        const target = this.renderer.svg || this.renderer.canvas;
        target.addEventListener('dragover', this._onDragOver.bind(this));
        target.addEventListener('drop', this._onDrop.bind(this));
    }

    _onDragStart(e) {
        const item = e.target.closest('.palette-item');
        if (!item) return;

        this.draggedType = item.dataset.type;

        // Create ghost
        this.dragGhost = item.cloneNode(true);
        this.dragGhost.className = 'palette-drag-ghost';
        document.body.appendChild(this.dragGhost);

        e.dataTransfer.setDragImage(this.dragGhost, 30, 30);
        e.dataTransfer.effectAllowed = 'copy';
    }

    _onDragEnd(e) {
        this.draggedType = null;
        if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
        }
    }

    _onDragOver(e) {
        if (!this.draggedType) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    _onDrop(e) {
        if (!this.draggedType) return;
        e.preventDefault();

        const el = this.renderer.svg || this.renderer.canvas;
        const rect = el.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        // Snap to grid if enabled
        const settings = this.store.getSettings();
        let x = world.x;
        let y = world.y;

        if (settings.snapToGrid) {
            const gridSize = settings.gridSize;
            x = Math.round(x / gridSize) * gridSize;
            y = Math.round(y / gridSize) * gridSize;
        }

        // Create node
        const node = this.store.addNode(this.draggedType, x, y);

        // Select new node
        this.store.clearSelection();
        this.store.selectNode(node.id, true);

        this.draggedType = null;
    }
}
