/**
 * KeyboardHandler - handles keyboard shortcuts
 */

export class KeyboardHandler {
    constructor(store, renderer, mouseHandler, executor, callbacks = {}) {
        this.store = store;
        this.renderer = renderer;
        this.mouseHandler = mouseHandler;
        this.executor = executor;
        this.callbacks = callbacks;

        this.clipboard = null;

        this._bindEvents();
    }

    _bindEvents() {
        document.addEventListener('keydown', this._onKeyDown.bind(this));
        document.addEventListener('keyup', this._onKeyUp.bind(this));
    }

    _onKeyDown(e) {
        // Ignore if focus is on input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Space - pan mode
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            this.mouseHandler.setSpaceDown(true);
            return;
        }

        // Delete/Backspace - delete selected
        if (e.code === 'Delete' || e.code === 'Backspace') {
            e.preventDefault();
            this._deleteSelected();
            return;
        }

        // Escape - cancel/deselect
        if (e.code === 'Escape') {
            e.preventDefault();
            if (this.mouseHandler.dragHandler.isCreatingConnection) {
                this.mouseHandler.dragHandler.cancelConnectionDrag();
            } else {
                this.store.clearSelection();
            }
            if (this.callbacks.onEscape) {
                this.callbacks.onEscape();
            }
            return;
        }

        // Ctrl shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.code) {
                case 'KeyA':
                    e.preventDefault();
                    this._selectAll();
                    break;
                case 'KeyC':
                    e.preventDefault();
                    this._copy();
                    break;
                case 'KeyV':
                    e.preventDefault();
                    this._paste();
                    break;
                case 'KeyD':
                    e.preventDefault();
                    this._duplicate();
                    break;
                case 'KeyS':
                    e.preventDefault();
                    if (this.callbacks.onSave) {
                        this.callbacks.onSave();
                    }
                    break;
            }
            return;
        }

        // Run controls
        if (e.code === 'KeyR') {
            e.preventDefault();
            this._toggleRun();
            return;
        }

        if (e.code === 'KeyS') {
            e.preventDefault();
            this._step();
            return;
        }

        // Focus mode
        if (e.code === 'KeyF') {
            e.preventDefault();
            this.store.toggleFocusMode();
            return;
        }
    }

    _onKeyUp(e) {
        if (e.code === 'Space') {
            this.mouseHandler.setSpaceDown(false);
        }
    }

    _deleteSelected() {
        const selectedNodes = this.store.getSelectedNodes();
        if (selectedNodes.length === 0) return;

        selectedNodes.forEach(node => {
            this.store.removeNode(node.id);
        });

        if (this.callbacks.onNotify) {
            this.callbacks.onNotify(selectedNodes.length === 1 ? 'Node deleted' : `${selectedNodes.length} nodes deleted`);
        }
    }

    _selectAll() {
        this.store.selectAll();
    }

    _copy() {
        const selectedNodes = this.store.getSelectedNodes();
        if (selectedNodes.length === 0) return;

        this.clipboard = {
            nodes: selectedNodes.map(node => node.serialize()),
            connections: []
        };

        // Copy connections between selected nodes
        const selectedIds = new Set(selectedNodes.map(n => n.id));
        this.store.getConnections().forEach(conn => {
            if (selectedIds.has(conn.fromNodeId) && selectedIds.has(conn.toNodeId)) {
                this.clipboard.connections.push(conn.serialize());
            }
        });

        if (this.callbacks.onNotify) {
            this.callbacks.onNotify('Copied to clipboard');
        }
    }

    _paste() {
        if (!this.clipboard) return;

        const idMap = new Map();
        const offset = 50;

        // Create new nodes with new IDs
        this.clipboard.nodes.forEach(nodeData => {
            const newNodeData = { ...nodeData };
            newNodeData.position = {
                x: nodeData.position.x + offset,
                y: nodeData.position.y + offset
            };

            const newNode = this.store.addNode(newNodeData.type, newNodeData.position.x, newNodeData.position.y);
            newNode.collapsed = nodeData.collapsed;
            newNode.customTitle = nodeData.customTitle;
            Object.assign(newNode.properties, nodeData.properties);

            idMap.set(nodeData.id, newNode.id);
        });

        // Recreate connections with new IDs
        this.clipboard.connections.forEach(connData => {
            const newFromId = idMap.get(connData.from);
            const newToId = idMap.get(connData.to);
            if (newFromId && newToId) {
                this.store.addConnection(newFromId, connData.fromPort, newToId, connData.toPort);
            }
        });

        // Select pasted nodes
        this.store.clearSelection();
        idMap.forEach((newId) => {
            this.store.selectNode(newId, true);
        });

        // Update clipboard for future pastes
        this.clipboard.nodes.forEach(nodeData => {
            nodeData.position.x += offset;
            nodeData.position.y += offset;
        });

        if (this.callbacks.onNotify) {
            this.callbacks.onNotify('Pasted');
        }
    }

    _duplicate() {
        const selectedNodes = this.store.getSelectedNodes();
        if (selectedNodes.length === 0) return;

        // Temporarily store in clipboard and paste
        const prevClipboard = this.clipboard;
        this._copy();
        this._paste();
        this.clipboard = prevClipboard;
    }

    _toggleRun() {
        if (!this.executor) return;

        if (this.executor.isRunning()) {
            this.executor.pause();
        } else {
            this.executor.start();
        }
    }

    _step() {
        if (!this.executor) return;
        this.executor.step();
    }
}
