/**
 * SVG Renderer - renders workflow using SVG elements
 */
import { EventEmitter } from '../utils/event-emitter.js';
import { withAlpha, getContrastColor } from '../utils/colors.js';

export class SvgRenderer extends EventEmitter {
    constructor(container) {
        super();
        this.container = container;

        // Create SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.position = 'absolute';
        this.svg.style.top = '0';
        this.svg.style.left = '0';
        container.appendChild(this.svg);

        // Create layers
        this.gridLayer = this.createGroup('grid-layer');
        this.connectionLayer = this.createGroup('connection-layer');
        this.nodeLayer = this.createGroup('node-layer');
        this.overlayLayer = this.createGroup('overlay-layer');

        // Viewport
        this.viewport = { panX: 0, panY: 0, zoom: 1 };

        // Settings
        this.showGrid = true;
        this.gridSize = 20;

        // State
        this.nodeElements = new Map();
        this.connectionElements = new Map();
        this.hoveredNode = null;
        this.hoveredPort = null;
        this.tempConnection = null;
        this.selectionBox = null;

        // Store reference for requestRender
        this._lastNodes = null;
        this._lastConnections = null;

        // Colors
        this.colors = {
            background: '#0E1514',
            surface: '#1A2120',
            surfaceHigh: '#252B2A',
            outline: '#3F4946',
            onSurface: '#DEE4E1',
            onSurfaceVariant: '#BEC9C5',
            primary: '#91C6BC',
            gridLine: '#1F2726'
        };

        this.renderGrid();
    }

    createGroup(id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', id);
        this.svg.appendChild(g);
        return g;
    }

    setViewport(panX, panY, zoom) {
        this.viewport = { panX, panY, zoom };
        this.updateTransform();
    }

    updateTransform() {
        const { panX, panY, zoom } = this.viewport;
        const transform = `translate(${panX}, ${panY}) scale(${zoom})`;
        this.gridLayer.setAttribute('transform', transform);
        this.connectionLayer.setAttribute('transform', transform);
        this.nodeLayer.setAttribute('transform', transform);
        this.overlayLayer.setAttribute('transform', transform);
    }

    setGridSettings(show, size) {
        this.showGrid = show;
        this.gridSize = size;
        this.renderGrid();
    }

    renderGrid() {
        this.gridLayer.innerHTML = '';
        if (!this.showGrid) return;

        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid-pattern');
        pattern.setAttribute('width', this.gridSize);
        pattern.setAttribute('height', this.gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '0');
        line1.setAttribute('y1', '0');
        line1.setAttribute('x2', this.gridSize);
        line1.setAttribute('y2', '0');
        line1.setAttribute('stroke', this.colors.gridLine);
        line1.setAttribute('stroke-width', '0.5');

        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '0');
        line2.setAttribute('y1', '0');
        line2.setAttribute('x2', '0');
        line2.setAttribute('y2', this.gridSize);
        line2.setAttribute('stroke', this.colors.gridLine);
        line2.setAttribute('stroke-width', '0.5');

        pattern.appendChild(line1);
        pattern.appendChild(line2);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.appendChild(pattern);
        this.gridLayer.appendChild(defs);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '-10000');
        rect.setAttribute('y', '-10000');
        rect.setAttribute('width', '20000');
        rect.setAttribute('height', '20000');
        rect.setAttribute('fill', 'url(#grid-pattern)');
        this.gridLayer.appendChild(rect);
    }

    render(nodes, connections) {
        // Store for requestRender
        this._lastNodes = nodes;
        this._lastConnections = connections;

        this.renderConnections(connections, nodes);
        this.renderNodes(nodes);
        this.renderTempConnection();
        this.renderSelectionBox();
    }

    renderNodes(nodes) {
        const existingIds = new Set(this.nodeElements.keys());

        nodes.forEach(node => {
            existingIds.delete(node.id);
            this.renderNode(node);
        });

        // Remove deleted nodes
        existingIds.forEach(id => {
            const el = this.nodeElements.get(id);
            if (el) el.remove();
            this.nodeElements.delete(id);
        });
    }

    renderNode(node) {
        let group = this.nodeElements.get(node.id);

        if (!group) {
            group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('data-node-id', node.id);
            group.classList.add('node');
            this.nodeLayer.appendChild(group);
            this.nodeElements.set(node.id, group);
        }

        group.innerHTML = '';
        group.setAttribute('transform', `translate(${node.x}, ${node.y})`);

        if (node.isCircular()) {
            this.renderCircularNode(group, node);
        } else if (node.collapsed) {
            this.renderCollapsedNode(group, node);
        } else {
            this.renderExpandedNode(group, node);
        }
    }

    renderCircularNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        const cx = w / 2;
        const cy = h / 2;
        const r = w / 2;
        const color = node.getColor();

        // Glow effect for active/waiting
        if (node.runState === 'active' || node.runState === 'waiting') {
            const glow = this.createCircle(cx, cy, r + 4, 'none', color);
            glow.setAttribute('filter', 'url(#glow)');
            glow.setAttribute('opacity', '0.6');
            group.appendChild(glow);
        }

        // Main circle
        const circle = this.createCircle(cx, cy, r, color, 'none');
        if (node.selected) {
            circle.setAttribute('stroke', this.colors.primary);
            circle.setAttribute('stroke-width', '2');
        }
        group.appendChild(circle);

        // Icon
        const icon = this.createText(cx, cy, node.getIcon(), getContrastColor(color), '20px');
        icon.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(icon);

        // Ports
        this.renderPorts(group, node);

        // Completed badge
        if (node.runState === 'completed') {
            this.renderCompletedBadge(group, w - 8, 8);
        }
    }

    renderCollapsedNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        const color = node.getColor();

        // Background
        const bg = this.createRect(0, 0, w, h, 3, this.colors.surface);
        bg.setAttribute('stroke', node.selected ? this.colors.primary : this.colors.outline);
        bg.setAttribute('stroke-width', node.selected ? '2' : '1');

        if (node.runState === 'active' || node.runState === 'waiting') {
            bg.setAttribute('filter', 'url(#glow)');
        }
        group.appendChild(bg);

        // Inner circle
        const innerR = 18;
        const circle = this.createCircle(w / 2, h / 2, innerR, color, 'none');
        group.appendChild(circle);

        // Icon
        const icon = this.createText(w / 2, h / 2, node.getIcon(), getContrastColor(color), '24px');
        icon.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(icon);

        // Ports
        this.renderPorts(group, node);

        // Completed badge
        if (node.runState === 'completed') {
            this.renderCompletedBadge(group, w - 4, 4);
        }
    }

    renderExpandedNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        const headerHeight = 36;
        const color = node.getColor();

        // Background
        const bg = this.createRect(0, 0, w, h, 4, this.colors.surface);
        bg.setAttribute('stroke', node.selected ? this.colors.primary : this.colors.outline);
        bg.setAttribute('stroke-width', node.selected ? '2' : '1');

        if (node.runState === 'active' || node.runState === 'waiting') {
            bg.setAttribute('filter', 'url(#glow)');
        }
        group.appendChild(bg);

        // Header
        const header = this.createRect(0, 0, w, headerHeight, 4, color);
        header.setAttribute('clip-path', 'inset(0 0 0 0 round 4px 4px 0 0)');
        group.appendChild(header);

        // Header clip (to make bottom corners square)
        const headerBottom = this.createRect(0, headerHeight - 4, w, 4, 0, color);
        group.appendChild(headerBottom);

        // Icon
        const icon = this.createText(16, headerHeight / 2, node.getIcon(), getContrastColor(color), '20px');
        icon.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(icon);

        // Title
        const title = this.createText(32, headerHeight / 2, node.getDisplayTitle(), getContrastColor(color), '13px');
        title.setAttribute('text-anchor', 'start');
        title.setAttribute('font-weight', '500');
        group.appendChild(title);

        // Preview text
        if (typeof node.getPreviewText === 'function') {
            const preview = this.createText(16, headerHeight + 20, node.getPreviewText(), this.colors.onSurfaceVariant, '12px');
            preview.setAttribute('text-anchor', 'start');
            group.appendChild(preview);
        }

        // Progress bar for delay nodes
        if (node.getType() === 'delay' && node.runState === 'waiting' && node.progress > 0) {
            const barY = h - 8;
            const barWidth = w - 32;
            const barBg = this.createRect(16, barY, barWidth, 4, 2, this.colors.outline);
            group.appendChild(barBg);

            const barFill = this.createRect(16, barY, barWidth * node.progress, 4, 2, this.colors.primary);
            group.appendChild(barFill);
        }

        // Ports
        this.renderPorts(group, node);

        // Completed badge
        if (node.runState === 'completed') {
            this.renderCompletedBadge(group, w - 8, 8);
        }
    }

    renderPorts(group, node) {
        const inputPorts = node.getInputPorts();
        const outputPorts = node.getOutputPorts();

        inputPorts.forEach(port => {
            const pos = node.getPortPosition(port.id, true);
            const localPos = { x: pos.x - node.x, y: pos.y - node.y };
            this.renderPort(group, localPos, port, true, node);
        });

        outputPorts.forEach(port => {
            const pos = node.getPortPosition(port.id, false);
            const localPos = { x: pos.x - node.x, y: pos.y - node.y };
            this.renderPort(group, localPos, port, false, node);
        });
    }

    renderPort(group, pos, port, isInput, node) {
        const isHovered = this.hoveredPort &&
                          this.hoveredPort.nodeId === node.id &&
                          this.hoveredPort.portId === port.id;
        const r = isHovered ? 10 : 7;

        const circle = this.createCircle(pos.x, pos.y, r, this.colors.surfaceHigh, this.colors.outline);
        circle.setAttribute('stroke-width', isHovered ? '2' : '1');
        if (isHovered) {
            circle.setAttribute('stroke', this.colors.primary);
        }
        circle.classList.add('port');
        circle.setAttribute('data-port-id', port.id);
        circle.setAttribute('data-is-input', isInput);
        group.appendChild(circle);
    }

    renderCompletedBadge(group, x, y) {
        const circle = this.createCircle(x, y, 10, '#81C784', 'none');
        group.appendChild(circle);

        const check = this.createText(x, y, 'check', '#FFFFFF', '16px');
        check.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(check);
    }

    renderConnections(connections, nodes) {
        const existingIds = new Set(this.connectionElements.keys());

        connections.forEach(conn => {
            existingIds.delete(conn.id);
            this.renderConnection(conn, nodes);
        });

        // Remove deleted connections
        existingIds.forEach(id => {
            const el = this.connectionElements.get(id);
            if (el) el.remove();
            this.connectionElements.delete(id);
        });
    }

    renderConnection(conn, nodes) {
        const fromNode = nodes.get(conn.fromNodeId);
        const toNode = nodes.get(conn.toNodeId);
        if (!fromNode || !toNode) return;

        const fromPos = fromNode.getPortPosition(conn.fromPortId, false);
        const toPos = toNode.getPortPosition(conn.toPortId, true);

        let path = this.connectionElements.get(conn.id);
        if (!path) {
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('data-connection-id', conn.id);
            path.classList.add('connection');
            this.connectionLayer.appendChild(path);
            this.connectionElements.set(conn.id, path);
        }

        const d = this.createBezierPath(fromPos, toPos);
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', this.colors.primary);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
    }

    createBezierPath(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = to.y - from.y;
        const curvature = Math.min(Math.max(dy * 0.5, 50), 150);

        return `M ${from.x} ${from.y} C ${from.x} ${from.y + curvature}, ${to.x} ${to.y - curvature}, ${to.x} ${to.y}`;
    }

    setTempConnection(from, to) {
        this.tempConnection = from && to ? { from, to } : null;
        this.renderTempConnection();
    }

    renderTempConnection() {
        let path = this.overlayLayer.querySelector('.temp-connection');

        if (!this.tempConnection) {
            if (path) path.remove();
            return;
        }

        if (!path) {
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('temp-connection');
            this.overlayLayer.appendChild(path);
        }

        const d = this.createBezierPath(this.tempConnection.from, this.tempConnection.to);
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', this.colors.primary);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '5,5');
        path.setAttribute('stroke-linecap', 'round');
    }

    setSelectionBox(box) {
        this.selectionBox = box;
        this.renderSelectionBox();
    }

    renderSelectionBox() {
        let rect = this.overlayLayer.querySelector('.selection-box');

        if (!this.selectionBox) {
            if (rect) rect.remove();
            return;
        }

        if (!rect) {
            rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('selection-box');
            this.overlayLayer.appendChild(rect);
        }

        rect.setAttribute('x', this.selectionBox.x);
        rect.setAttribute('y', this.selectionBox.y);
        rect.setAttribute('width', this.selectionBox.width);
        rect.setAttribute('height', this.selectionBox.height);
        rect.setAttribute('fill', 'rgba(145, 198, 188, 0.1)');
        rect.setAttribute('stroke', this.colors.primary);
        rect.setAttribute('stroke-dasharray', '4,4');
    }

    // Helper methods
    createRect(x, y, w, h, r, fill) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', r);
        rect.setAttribute('fill', fill);
        return rect;
    }

    createCircle(cx, cy, r, fill, stroke) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', fill);
        if (stroke) circle.setAttribute('stroke', stroke);
        return circle;
    }

    createText(x, y, text, fill, size) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('fill', fill);
        el.setAttribute('font-size', size);
        el.setAttribute('font-family', 'Roboto, sans-serif');
        el.setAttribute('text-anchor', 'middle');
        el.setAttribute('dominant-baseline', 'central');
        el.textContent = text;
        return el;
    }

    // Coordinate conversion
    screenToWorld(screenX, screenY) {
        // screenX/screenY are already relative to the SVG element
        return {
            x: (screenX - this.viewport.panX) / this.viewport.zoom,
            y: (screenY - this.viewport.panY) / this.viewport.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.viewport.zoom + this.viewport.panX,
            y: worldY * this.viewport.zoom + this.viewport.panY
        };
    }

    // Hit testing
    getNodeAt(worldX, worldY, nodes) {
        const nodeArray = Array.from(nodes.values()).reverse();
        for (const node of nodeArray) {
            const bounds = node.getBounds();
            if (node.isCircular()) {
                const cx = bounds.x + bounds.width / 2;
                const cy = bounds.y + bounds.height / 2;
                const r = bounds.width / 2;
                const dx = worldX - cx;
                const dy = worldY - cy;
                if (dx * dx + dy * dy <= r * r) return node;
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
        const portRadius = 10;
        for (const node of nodes.values()) {
            for (const port of node.getInputPorts()) {
                const pos = node.getPortPosition(port.id, true);
                const dx = worldX - pos.x;
                const dy = worldY - pos.y;
                if (dx * dx + dy * dy <= portRadius * portRadius) {
                    return { nodeId: node.id, portId: port.id, isInput: true, position: pos };
                }
            }
            for (const port of node.getOutputPorts()) {
                const pos = node.getPortPosition(port.id, false);
                const dx = worldX - pos.x;
                const dy = worldY - pos.y;
                if (dx * dx + dy * dy <= portRadius * portRadius) {
                    return { nodeId: node.id, portId: port.id, isInput: false, position: pos };
                }
            }
        }
        return null;
    }

    getConnectionAt(worldX, worldY, connections, nodes) {
        // Simple distance-based check for connections
        for (const conn of connections.values()) {
            const fromNode = nodes.get(conn.fromNodeId);
            const toNode = nodes.get(conn.toNodeId);
            if (!fromNode || !toNode) continue;

            const from = fromNode.getPortPosition(conn.fromPortId, false);
            const to = toNode.getPortPosition(conn.toPortId, true);

            // Check distance to bezier curve (simplified)
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = worldX - midX;
            const dy = worldY - midY;
            if (dx * dx + dy * dy < 400) return conn;
        }
        return null;
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

        const rect = this.svg.getBoundingClientRect();
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const scaleX = rect.width / contentWidth;
        const scaleY = rect.height / contentHeight;
        const zoom = Math.min(scaleX, scaleY, 2);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const panX = rect.width / 2 - centerX * zoom;
        const panY = rect.height / 2 - centerY * zoom;

        this.setViewport(panX, panY, zoom);
    }

    setHoveredNode(node) {
        this.hoveredNode = node;
    }

    setHoveredPort(port) {
        this.hoveredPort = port;
    }

    setHoveredConnection(conn) {
        // Could add hover styling here
    }

    requestRender() {
        // Re-render with last known nodes/connections
        if (this._lastNodes && this._lastConnections) {
            this.render(this._lastNodes, this._lastConnections);
        }
    }

    resize(width, height) {
        // SVG auto-resizes with CSS
    }
}
