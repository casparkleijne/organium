/**
 * DragHandler - handles node and connection dragging
 */
import { snapToGrid } from '../utils/geometry.js';

export class DragHandler {
    constructor(store, renderer) {
        this.store = store;
        this.renderer = renderer;

        this.isDragging = false;
        this.isCreatingConnection = false;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsets = new Map(); // nodeId -> {dx, dy}

        this.connectionStart = null; // {nodeId, portId, isInput, position}
        this.connectionEnd = null;

        // For inserting nodes into connections
        this.insertTargetConnection = null;
    }

    startNodeDrag(x, y, nodes) {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
        this.dragOffsets.clear();

        nodes.forEach(node => {
            this.dragOffsets.set(node.id, {
                dx: node.x - x,
                dy: node.y - y
            });
        });
    }

    updateNodeDrag(x, y, hoveredConnection = null) {
        if (!this.isDragging) return;

        const settings = this.store.getSettings();
        const gridSize = settings.gridSize || 20;
        const snapEnabled = settings.snapToGrid;

        this.dragOffsets.forEach((offset, nodeId) => {
            const node = this.store.getNode(nodeId);
            if (!node) return;

            let newX = x + offset.dx;
            let newY = y + offset.dy;

            if (snapEnabled) {
                newX = snapToGrid(newX, gridSize);
                newY = snapToGrid(newY, gridSize);
            }

            node.moveTo(newX, newY);
        });

        // Check if we can insert into the hovered connection
        if (hoveredConnection && this.canInsertIntoConnection(hoveredConnection)) {
            this.insertTargetConnection = hoveredConnection;
            this.renderer.setInsertTargetConnection(hoveredConnection);
        } else {
            this.insertTargetConnection = null;
            this.renderer.setInsertTargetConnection(null);
        }

        this.renderer.requestRender();
    }

    canInsertIntoConnection(connection) {
        // Only allow insertion when dragging a single node
        if (this.dragOffsets.size !== 1) return false;

        const nodeId = this.dragOffsets.keys().next().value;
        const node = this.store.getNode(nodeId);
        if (!node) return false;

        // Node must have at least one input and one output port
        const inputPorts = node.getInputPorts();
        const outputPorts = node.getOutputPorts();
        if (inputPorts.length === 0 || outputPorts.length === 0) return false;

        // Can't insert into a connection that involves the dragged node
        if (connection.fromNodeId === nodeId || connection.toNodeId === nodeId) return false;

        return true;
    }

    endNodeDrag() {
        const insertTarget = this.insertTargetConnection;
        const draggedNodeId = this.dragOffsets.size === 1
            ? this.dragOffsets.keys().next().value
            : null;

        this.isDragging = false;
        this.dragOffsets.clear();
        this.insertTargetConnection = null;
        this.renderer.setInsertTargetConnection(null);

        // Return insert info if we were over a valid connection
        if (insertTarget && draggedNodeId) {
            return {
                connection: insertTarget,
                nodeId: draggedNodeId
            };
        }
        return null;
    }

    startConnectionDrag(portInfo) {
        this.isCreatingConnection = true;
        this.connectionStart = portInfo;
        this.connectionEnd = portInfo.position;
    }

    updateConnectionDrag(worldX, worldY, hoveredPort) {
        if (!this.isCreatingConnection) return;

        if (hoveredPort && this.isValidConnection(hoveredPort)) {
            this.connectionEnd = hoveredPort.position;
        } else {
            this.connectionEnd = { x: worldX, y: worldY };
        }

        // Update temp connection visualization
        if (this.connectionStart.isInput) {
            this.renderer.setTempConnection(this.connectionEnd, this.connectionStart.position);
        } else {
            this.renderer.setTempConnection(this.connectionStart.position, this.connectionEnd);
        }
    }

    endConnectionDrag(hoveredPort) {
        if (!this.isCreatingConnection) {
            return null;
        }

        this.renderer.setTempConnection(null, null);
        this.isCreatingConnection = false;

        if (!hoveredPort || !this.isValidConnection(hoveredPort)) {
            this.connectionStart = null;
            this.connectionEnd = null;
            return null;
        }

        // Create connection
        let fromNodeId, fromPortId, toNodeId, toPortId;

        if (this.connectionStart.isInput) {
            // Started from input, ended on output
            fromNodeId = hoveredPort.nodeId;
            fromPortId = hoveredPort.portId;
            toNodeId = this.connectionStart.nodeId;
            toPortId = this.connectionStart.portId;
        } else {
            // Started from output, ended on input
            fromNodeId = this.connectionStart.nodeId;
            fromPortId = this.connectionStart.portId;
            toNodeId = hoveredPort.nodeId;
            toPortId = hoveredPort.portId;
        }

        this.connectionStart = null;
        this.connectionEnd = null;

        return { fromNodeId, fromPortId, toNodeId, toPortId };
    }

    isValidConnection(targetPort) {
        if (!this.connectionStart) return false;

        // Must be different node
        if (targetPort.nodeId === this.connectionStart.nodeId) return false;

        // Must be different port type (input <-> output)
        if (targetPort.isInput === this.connectionStart.isInput) return false;

        // Check if connection already exists
        const fromNodeId = this.connectionStart.isInput ? targetPort.nodeId : this.connectionStart.nodeId;
        const fromPortId = this.connectionStart.isInput ? targetPort.portId : this.connectionStart.portId;
        const toNodeId = this.connectionStart.isInput ? this.connectionStart.nodeId : targetPort.nodeId;
        const toPortId = this.connectionStart.isInput ? this.connectionStart.portId : targetPort.portId;

        const connections = this.store.getConnections();
        for (const conn of connections.values()) {
            if (conn.fromNodeId === fromNodeId && conn.fromPortId === fromPortId &&
                conn.toNodeId === toNodeId && conn.toPortId === toPortId) {
                return false;
            }
        }

        return true;
    }

    cancelConnectionDrag() {
        this.isCreatingConnection = false;
        this.connectionStart = null;
        this.connectionEnd = null;
        this.renderer.setTempConnection(null, null);
    }
}
