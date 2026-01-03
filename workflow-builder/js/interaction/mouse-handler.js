/**
 * MouseHandler - handles all mouse interactions on canvas
 */
import { DragHandler } from './drag-handler.js';
import { PanZoomHandler } from './pan-zoom-handler.js';

export class MouseHandler {
    constructor(canvas, store, renderer, onContextMenu) {
        this.canvas = canvas;
        this.store = store;
        this.renderer = renderer;
        this.onContextMenu = onContextMenu;

        this.dragHandler = new DragHandler(store, renderer);
        this.panZoomHandler = new PanZoomHandler(store, renderer);

        this.spaceDown = false;
        this.isSelecting = false;
        this.selectionStart = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContextMenu.bind(this));
        this.canvas.addEventListener('dblclick', this._onDoubleClick.bind(this));
    }

    setSpaceDown(down) {
        this.spaceDown = down;
        this.canvas.style.cursor = down ? 'grab' : 'default';
    }

    _onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        // Middle mouse or space + left click = pan
        if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
            e.preventDefault();
            this.panZoomHandler.startPan(screenX, screenY);
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;

        // Check for port click first
        const port = this.renderer.getPortAt(world.x, world.y, this.store.getNodes());
        if (port) {
            this.dragHandler.startConnectionDrag(port);
            return;
        }

        // Check for node click
        const node = this.renderer.getNodeAt(world.x, world.y, this.store.getNodes());
        if (node) {
            if (!node.selected) {
                if (!e.shiftKey && !e.ctrlKey) {
                    this.store.clearSelection();
                }
                this.store.selectNode(node.id, true);
            } else if (e.ctrlKey || e.shiftKey) {
                this.store.selectNode(node.id, false);
                return;
            }

            // Start dragging selected nodes
            const selectedNodes = this.store.getSelectedNodes();
            this.dragHandler.startNodeDrag(world.x, world.y, selectedNodes);
            return;
        }

        // Check for connection click
        const connection = this.renderer.getConnectionAt(world.x, world.y, this.store.getConnections(), this.store.getNodes());
        if (connection) {
            if (!e.shiftKey && !e.ctrlKey) {
                this.store.clearSelection();
            }
            // Could implement connection selection here
            return;
        }

        // Empty canvas click - start selection box
        if (!e.shiftKey && !e.ctrlKey) {
            this.store.clearSelection();
        }
        this.isSelecting = true;
        this.selectionStart = { x: screenX, y: screenY };
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        // Handle panning
        if (this.panZoomHandler.isPanning) {
            this.panZoomHandler.updatePan(screenX, screenY);
            return;
        }

        // Handle node dragging
        if (this.dragHandler.isDragging) {
            // Check if dragging over a connection for insertion
            const connection = this.renderer.getConnectionAt(
                world.x, world.y,
                this.store.getConnections(),
                this.store.getNodes()
            );
            this.dragHandler.updateNodeDrag(world.x, world.y, connection);
            return;
        }

        // Handle connection creation
        if (this.dragHandler.isCreatingConnection) {
            const port = this.renderer.getPortAt(world.x, world.y, this.store.getNodes());
            this.renderer.setHoveredPort(port);
            this.dragHandler.updateConnectionDrag(world.x, world.y, port);
            return;
        }

        // Handle selection box
        if (this.isSelecting) {
            const width = screenX - this.selectionStart.x;
            const height = screenY - this.selectionStart.y;
            this.renderer.setSelectionBox({
                x: Math.min(screenX, this.selectionStart.x),
                y: Math.min(screenY, this.selectionStart.y),
                width: Math.abs(width),
                height: Math.abs(height)
            });
            return;
        }

        // Hover detection
        const port = this.renderer.getPortAt(world.x, world.y, this.store.getNodes());
        this.renderer.setHoveredPort(port);

        if (!port) {
            const node = this.renderer.getNodeAt(world.x, world.y, this.store.getNodes());
            this.renderer.setHoveredNode(node);

            const connection = this.renderer.getConnectionAt(world.x, world.y, this.store.getConnections(), this.store.getNodes());
            this.renderer.setHoveredConnection(connection);
        } else {
            this.renderer.setHoveredNode(null);
            this.renderer.setHoveredConnection(null);
        }

        // Update cursor
        if (port) {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.renderer.hoveredNode) {
            this.canvas.style.cursor = 'move';
        } else if (this.renderer.hoveredConnection) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = this.spaceDown ? 'grab' : 'default';
        }
    }

    _onMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        // End panning
        if (this.panZoomHandler.isPanning) {
            this.panZoomHandler.endPan();
            this.canvas.style.cursor = this.spaceDown ? 'grab' : 'default';
            return;
        }

        // End node dragging
        if (this.dragHandler.isDragging) {
            const insertInfo = this.dragHandler.endNodeDrag();
            if (insertInfo) {
                this._insertNodeIntoConnection(insertInfo.nodeId, insertInfo.connection);
            }
            return;
        }

        // End connection creation
        if (this.dragHandler.isCreatingConnection) {
            const port = this.renderer.getPortAt(world.x, world.y, this.store.getNodes());
            const connection = this.dragHandler.endConnectionDrag(port);
            if (connection) {
                this.store.addConnection(
                    connection.fromNodeId,
                    connection.fromPortId,
                    connection.toNodeId,
                    connection.toPortId
                );
            }
            this.renderer.setHoveredPort(null);
            return;
        }

        // End selection box
        if (this.isSelecting) {
            const box = this.renderer.selectionBox;
            if (box && box.width > 5 && box.height > 5) {
                // Convert screen box to world coordinates
                const topLeft = this.renderer.screenToWorld(box.x, box.y);
                const bottomRight = this.renderer.screenToWorld(box.x + box.width, box.y + box.height);
                const worldBox = {
                    x: topLeft.x,
                    y: topLeft.y,
                    width: bottomRight.x - topLeft.x,
                    height: bottomRight.y - topLeft.y
                };

                const nodesInBox = this.renderer.getNodesInRect(worldBox, this.store.getNodes());
                nodesInBox.forEach(node => this.store.selectNode(node.id, true));
            }

            this.isSelecting = false;
            this.selectionStart = null;
            this.renderer.setSelectionBox(null);
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        this.panZoomHandler.zoom(e.deltaY, screenX, screenY);
    }

    _onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        const node = this.renderer.getNodeAt(world.x, world.y, this.store.getNodes());
        const connection = node ? null : this.renderer.getConnectionAt(world.x, world.y, this.store.getConnections(), this.store.getNodes());

        if (this.onContextMenu) {
            this.onContextMenu(e.clientX, e.clientY, node, connection, world);
        }
    }

    _onDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.renderer.screenToWorld(screenX, screenY);

        const node = this.renderer.getNodeAt(world.x, world.y, this.store.getNodes());
        if (node) {
            node.toggleCollapsed();
            this.renderer.requestRender();
        }
    }

    _insertNodeIntoConnection(nodeId, connection) {
        const node = this.store.getNode(nodeId);
        if (!node) return;

        // Get the first input and output ports
        const inputPorts = node.getInputPorts();
        const outputPorts = node.getOutputPorts();
        if (inputPorts.length === 0 || outputPorts.length === 0) return;

        const inputPortId = inputPorts[0].id;
        const outputPortId = outputPorts[0].id;

        // Store original connection info
        const { fromNodeId, fromPortId, toNodeId, toPortId } = connection;

        // Remove the original connection
        this.store.removeConnection(connection.id);

        // Create two new connections through the inserted node
        this.store.addConnection(fromNodeId, fromPortId, nodeId, inputPortId);
        this.store.addConnection(nodeId, outputPortId, toNodeId, toPortId);
    }
}
