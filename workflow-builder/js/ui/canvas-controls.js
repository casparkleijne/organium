/**
 * CanvasControls - zoom and view controls
 */

export class CanvasControls {
    constructor(container, store, renderer, panZoomHandler) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;
        this.panZoomHandler = panZoomHandler;

        this.render();
        this._bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="canvas-controls">
                <button class="canvas-btn" id="zoomInBtn" title="Zoom in">
                    <span class="material-symbols-outlined">add</span>
                </button>
                <button class="canvas-btn" id="zoomOutBtn" title="Zoom out">
                    <span class="material-symbols-outlined">remove</span>
                </button>
                <button class="canvas-btn" id="resetZoomBtn" title="Reset zoom">
                    <span class="material-symbols-outlined">reset_image</span>
                </button>
                <button class="canvas-btn" id="fitContentBtn" title="Fit to content">
                    <span class="material-symbols-outlined">fit_screen</span>
                </button>
                <div class="canvas-controls-divider"></div>
                <button class="canvas-btn" id="collapseAllBtn" title="Collapse all">
                    <span class="material-symbols-outlined">unfold_less</span>
                </button>
                <button class="canvas-btn" id="expandAllBtn" title="Expand all">
                    <span class="material-symbols-outlined">unfold_more</span>
                </button>
                <button class="canvas-btn" id="autoDistributeBtn" title="Auto-distribute">
                    <span class="material-symbols-outlined">auto_fix</span>
                </button>
            </div>
        `;
    }

    _bindEvents() {
        this.container.querySelector('#zoomInBtn').addEventListener('click', () => {
            this.panZoomHandler.zoomIn();
        });

        this.container.querySelector('#zoomOutBtn').addEventListener('click', () => {
            this.panZoomHandler.zoomOut();
        });

        this.container.querySelector('#resetZoomBtn').addEventListener('click', () => {
            this.panZoomHandler.resetZoom();
        });

        this.container.querySelector('#fitContentBtn').addEventListener('click', () => {
            this.panZoomHandler.fitToContent();
        });

        this.container.querySelector('#collapseAllBtn').addEventListener('click', () => {
            this._collapseAll();
        });

        this.container.querySelector('#expandAllBtn').addEventListener('click', () => {
            this._expandAll();
        });

        this.container.querySelector('#autoDistributeBtn').addEventListener('click', () => {
            this._autoDistribute();
        });
    }

    _collapseAll() {
        const nodes = this.store.getNodes();
        nodes.forEach(node => {
            if (!node.collapsed && !node.isCircular()) {
                node.setCollapsed(true);
            }
        });
        this.renderer.requestRender();
    }

    _expandAll() {
        const nodes = this.store.getNodes();
        nodes.forEach(node => {
            if (node.collapsed) {
                node.setCollapsed(false);
            }
        });
        this.renderer.requestRender();
    }

    _autoDistribute() {
        const nodes = Array.from(this.store.getNodes().values());
        if (nodes.length === 0) return;

        const connections = this.store.getConnections();

        // Build adjacency lists
        const outgoing = new Map(); // nodeId -> [nodeIds]
        const incoming = new Map(); // nodeId -> [nodeIds]

        nodes.forEach(node => {
            outgoing.set(node.id, []);
            incoming.set(node.id, []);
        });

        connections.forEach(conn => {
            outgoing.get(conn.fromNodeId)?.push(conn.toNodeId);
            incoming.get(conn.toNodeId)?.push(conn.fromNodeId);
        });

        // Find root nodes (no incoming connections)
        const roots = nodes.filter(node => incoming.get(node.id).length === 0);

        // Assign levels using BFS
        const levels = new Map();
        const queue = [...roots];
        roots.forEach(node => levels.set(node.id, 0));

        while (queue.length > 0) {
            const node = queue.shift();
            const level = levels.get(node.id);

            for (const childId of outgoing.get(node.id)) {
                const existingLevel = levels.get(childId);
                if (existingLevel === undefined || existingLevel < level + 1) {
                    levels.set(childId, level + 1);
                    queue.push(this.store.getNode(childId));
                }
            }
        }

        // Handle disconnected nodes
        nodes.forEach(node => {
            if (!levels.has(node.id)) {
                levels.set(node.id, 0);
            }
        });

        // Group nodes by level
        const levelGroups = new Map();
        nodes.forEach(node => {
            const level = levels.get(node.id);
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level).push(node);
        });

        // Position nodes
        const startX = 100;
        const startY = 100;
        const horizontalGap = 250;
        const verticalGap = 120;

        levelGroups.forEach((levelNodes, level) => {
            const x = startX + level * horizontalGap;
            levelNodes.forEach((node, index) => {
                const y = startY + index * verticalGap;
                node.moveTo(x, y);
            });
        });

        this.renderer.requestRender();
        this.panZoomHandler.fitToContent();
    }
}
