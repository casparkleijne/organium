/**
 * Main Renderer - orchestrates all rendering
 */
import { GridRenderer } from './grid-renderer.js';
import { ConnectionRenderer } from './connection-renderer.js';
import { NodeRenderer } from './node-renderer.js';
import { MinimapRenderer } from './minimap-renderer.js';

export class Renderer {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.gridRenderer = new GridRenderer(this.ctx);
        this.connectionRenderer = new ConnectionRenderer(this.ctx);
        this.nodeRenderer = new NodeRenderer(this.ctx);
        this.minimapRenderer = minimapCanvas ? new MinimapRenderer(minimapCanvas) : null;

        this.viewport = {
            panX: 0,
            panY: 0,
            zoom: 1
        };

        this.backgroundColor = '#0E1514';
        this.selectionBoxColor = '#91C6BC';

        // Render state
        this.hoveredNode = null;
        this.hoveredPort = null;
        this.hoveredConnection = null;
        this.tempConnection = null;
        this.selectionBox = null;

        // Animation
        this.animationFrameId = null;
        this.needsRender = true;
    }

    setViewport(panX, panY, zoom) {
        this.viewport.panX = panX;
        this.viewport.panY = panY;
        this.viewport.zoom = zoom;
        this.requestRender();
    }

    setGridSettings(showGrid, gridSize) {
        this.gridRenderer.setShowGrid(showGrid);
        this.gridRenderer.setGridSize(gridSize);
        this.requestRender();
    }

    setHoveredNode(node) {
        if (this.hoveredNode !== node) {
            if (this.hoveredNode) this.hoveredNode.setHovered(false);
            this.hoveredNode = node;
            if (node) node.setHovered(true);
            this.requestRender();
        }
    }

    setHoveredPort(port) {
        this.hoveredPort = port;
        this.requestRender();
    }

    setHoveredConnection(connection) {
        this.hoveredConnection = connection;
        this.requestRender();
    }

    setTempConnection(from, to) {
        this.tempConnection = from && to ? { from, to } : null;
        this.requestRender();
    }

    setSelectionBox(box) {
        this.selectionBox = box;
        this.requestRender();
    }

    requestRender() {
        this.needsRender = true;
    }

    render(nodes, connections, executionState = null) {
        const ctx = this.ctx;
        const { panX, panY, zoom } = this.viewport;

        // Clear canvas
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply transform
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);

        // Render grid
        this.gridRenderer.render(this.viewport, this.canvas.width, this.canvas.height);

        // Render connections
        this.connectionRenderer.render(connections, nodes, this.hoveredConnection, executionState);

        // Render temp connection
        if (this.tempConnection) {
            this.connectionRenderer.renderTempConnection(
                this.tempConnection.from,
                this.tempConnection.to
            );
        }

        // Render nodes (back to front based on selection)
        const unselectedNodes = [];
        const selectedNodes = [];
        nodes.forEach(node => {
            if (node.selected) {
                selectedNodes.push(node);
            } else {
                unselectedNodes.push(node);
            }
        });

        unselectedNodes.forEach(node => this.nodeRenderer.render(node, this.hoveredPort));
        selectedNodes.forEach(node => this.nodeRenderer.render(node, this.hoveredPort));

        ctx.restore();

        // Render selection box (screen space)
        if (this.selectionBox) {
            this._renderSelectionBox();
        }

        // Update minimap
        if (this.minimapRenderer) {
            this.minimapRenderer.render(nodes, connections, this.viewport, this.canvas.width, this.canvas.height);
        }

        this.needsRender = false;
    }

    _renderSelectionBox() {
        const ctx = this.ctx;
        const box = this.selectionBox;

        ctx.save();
        ctx.strokeStyle = this.selectionBoxColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.fillStyle = 'rgba(145, 198, 188, 0.1)';
        ctx.fillRect(box.x, box.y, box.width, box.height);

        ctx.restore();
    }

    startRenderLoop(getState) {
        const loop = () => {
            if (this.needsRender) {
                const state = getState();
                this.render(state.nodes, state.connections, state.executionState);
            }
            this.animationFrameId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Coordinate conversion
    screenToWorld(screenX, screenY) {
        const { panX, panY, zoom } = this.viewport;
        return {
            x: (screenX - panX) / zoom,
            y: (screenY - panY) / zoom
        };
    }

    worldToScreen(worldX, worldY) {
        const { panX, panY, zoom } = this.viewport;
        return {
            x: worldX * zoom + panX,
            y: worldY * zoom + panY
        };
    }

    // Hit testing
    getNodeAt(worldX, worldY, nodes) {
        // Check in reverse order (top nodes first)
        const nodeArray = Array.from(nodes.values()).reverse();
        for (const node of nodeArray) {
            const bounds = node.getBounds();
            if (node.isCircular()) {
                const cx = bounds.x + bounds.width / 2;
                const cy = bounds.y + bounds.height / 2;
                const radius = bounds.width / 2;
                const dx = worldX - cx;
                const dy = worldY - cy;
                if (dx * dx + dy * dy <= radius * radius) {
                    return node;
                }
            } else {
                if (worldX >= bounds.x && worldX <= bounds.x + bounds.width &&
                    worldY >= bounds.y && worldY <= bounds.y + bounds.height) {
                    return node;
                }
            }
        }
        return null;
    }

    getPortAt(worldX, worldY, nodes) {
        return this.nodeRenderer.getPortAt(worldX, worldY, nodes);
    }

    getConnectionAt(worldX, worldY, connections, nodes) {
        return this.connectionRenderer.getConnectionAt(worldX, worldY, connections, nodes);
    }

    getNodesInRect(rect, nodes) {
        const result = [];
        nodes.forEach(node => {
            const bounds = node.getBounds();
            if (bounds.x >= rect.x && bounds.x + bounds.width <= rect.x + rect.width &&
                bounds.y >= rect.y && bounds.y + bounds.height <= rect.y + rect.height) {
                result.push(node);
            }
        });
        return result;
    }

    // Fit to content
    fitToContent(nodes, padding = 50) {
        if (nodes.size === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.getWidth());
            maxY = Math.max(maxY, node.y + node.getHeight());
        });

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const scaleX = this.canvas.width / contentWidth;
        const scaleY = this.canvas.height / contentHeight;
        const zoom = Math.min(scaleX, scaleY, 2);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const panX = this.canvas.width / 2 - centerX * zoom;
        const panY = this.canvas.height / 2 - centerY * zoom;

        this.setViewport(panX, panY, zoom);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.requestRender();
    }
}
