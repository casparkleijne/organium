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
        this.screenLayer = this.createGroup('screen-layer'); // No transform, for screen-space UI

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
        this.insertTargetConnection = null;

        // Progress dimming state
        this.progressDimmingEnabled = false;
        this.messageDots = new Map(); // connectionId -> dot element

        // Store reference for requestRender
        this._lastNodes = null;
        this._lastConnections = null;

        // Colors (dark theme default)
        this._darkColors = {
            background: '#0E1514',
            surface: '#1A2120',
            surfaceHigh: '#252B2A',
            outline: '#3F4946',
            onSurface: '#DEE4E1',
            onSurfaceVariant: '#BEC9C5',
            primary: '#91C6BC',
            tertiary: '#E37434',
            success: '#81C784',
            error: '#FFB4AB',
            gridLine: '#1F2726'
        };

        this._lightColors = {
            background: '#F5FBF8',
            surface: '#E9EFEC',
            surfaceHigh: '#E3EAE7',
            outline: '#BEC9C5',
            onSurface: '#171D1B',
            onSurfaceVariant: '#3F4946',
            primary: '#006B62',
            tertiary: '#C25D17',
            success: '#2E7D32',
            error: '#BA1A1A',
            gridLine: '#DAE5E1'
        };

        this.colors = { ...this._darkColors };

        // Create defs for filters (after colors are set)
        this._createDefs();

        this.renderGrid();
    }

    _createDefs() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // Liquid glass gradient for headers
        const glassGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        glassGradient.setAttribute('id', 'glassOverlay');
        glassGradient.setAttribute('x1', '0%');
        glassGradient.setAttribute('y1', '0%');
        glassGradient.setAttribute('x2', '0%');
        glassGradient.setAttribute('y2', '100%');

        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', 'white');
        stop1.setAttribute('stop-opacity', '0.35');
        glassGradient.appendChild(stop1);

        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '50%');
        stop2.setAttribute('stop-color', 'white');
        stop2.setAttribute('stop-opacity', '0.1');
        glassGradient.appendChild(stop2);

        const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop3.setAttribute('offset', '100%');
        stop3.setAttribute('stop-color', 'black');
        stop3.setAttribute('stop-opacity', '0.15');
        glassGradient.appendChild(stop3);

        defs.appendChild(glassGradient);

        // Highlight shine for top of header
        const shineGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        shineGradient.setAttribute('id', 'headerShine');
        shineGradient.setAttribute('x1', '0%');
        shineGradient.setAttribute('y1', '0%');
        shineGradient.setAttribute('x2', '100%');
        shineGradient.setAttribute('y2', '100%');

        const shineStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        shineStop1.setAttribute('offset', '0%');
        shineStop1.setAttribute('stop-color', 'white');
        shineStop1.setAttribute('stop-opacity', '0.4');
        shineGradient.appendChild(shineStop1);

        const shineStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        shineStop2.setAttribute('offset', '50%');
        shineStop2.setAttribute('stop-color', 'white');
        shineStop2.setAttribute('stop-opacity', '0');
        shineGradient.appendChild(shineStop2);

        defs.appendChild(shineGradient);

        // Glow filter for active/waiting nodes
        const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        glowFilter.setAttribute('id', 'glow');
        glowFilter.setAttribute('x', '-50%');
        glowFilter.setAttribute('y', '-50%');
        glowFilter.setAttribute('width', '200%');
        glowFilter.setAttribute('height', '200%');

        const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feGaussianBlur.setAttribute('stdDeviation', '4');
        feGaussianBlur.setAttribute('result', 'coloredBlur');
        glowFilter.appendChild(feGaussianBlur);

        const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        feMergeNode1.setAttribute('in', 'coloredBlur');
        const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        feMergeNode2.setAttribute('in', 'SourceGraphic');
        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        glowFilter.appendChild(feMerge);

        defs.appendChild(glowFilter);

        // Grayscale filter for idle nodes during execution
        const grayscaleFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        grayscaleFilter.setAttribute('id', 'grayscale');

        const feColorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
        feColorMatrix.setAttribute('type', 'saturate');
        feColorMatrix.setAttribute('values', '0');
        grayscaleFilter.appendChild(feColorMatrix);

        defs.appendChild(grayscaleFilter);

        // Selection shadow filter (elevated card style)
        const selectFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        selectFilter.setAttribute('id', 'selectShadow');
        selectFilter.setAttribute('x', '-50%');
        selectFilter.setAttribute('y', '-50%');
        selectFilter.setAttribute('width', '200%');
        selectFilter.setAttribute('height', '200%');

        const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
        feDropShadow.setAttribute('dx', '0');
        feDropShadow.setAttribute('dy', '2');
        feDropShadow.setAttribute('stdDeviation', '6');
        feDropShadow.setAttribute('flood-color', this.colors.primary);
        feDropShadow.setAttribute('flood-opacity', '0.5');
        selectFilter.appendChild(feDropShadow);

        defs.appendChild(selectFilter);

        this.svg.appendChild(defs);
    }

    setProgressDimming(enabled) {
        this.progressDimmingEnabled = enabled;
        if (!enabled) {
            // Clear message dots
            this.messageDots.forEach(dot => dot.remove());
            this.messageDots.clear();
        }
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

    setTheme(theme) {
        this.colors = theme === 'light' ? { ...this._lightColors } : { ...this._darkColors };
        this.renderGrid();
        this.requestRender();
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

        // Apply progress dimming styles
        if (this.progressDimmingEnabled) {
            const opacity = this._getNodeOpacity(node.runState);
            group.setAttribute('opacity', opacity);

            // Apply grayscale filter for idle nodes
            if (node.runState === 'idle') {
                group.setAttribute('filter', 'url(#grayscale)');
            } else {
                group.removeAttribute('filter');
            }

            // Add pulse animation class for waiting/active
            group.classList.remove('pulse-slow', 'pulse-glow');
            if (node.runState === 'waiting') {
                group.classList.add('pulse-slow');
            } else if (node.runState === 'active') {
                group.classList.add('pulse-glow');
            }
        } else {
            group.setAttribute('opacity', '1');
            group.removeAttribute('filter');
            group.classList.remove('pulse-slow', 'pulse-glow');
        }

        if (node.isCircular()) {
            this.renderCircularNode(group, node);
        } else if (node.collapsed) {
            this.renderCollapsedNode(group, node);
        } else {
            this.renderExpandedNode(group, node);
        }
    }

    _getNodeOpacity(runState) {
        switch (runState) {
            case 'idle': return 0.4;
            case 'waiting': return 0.7;
            case 'active':
            case 'completed':
            case 'error':
                return 1;
            default: return 1;
        }
    }

    renderCircularNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        const cx = w / 2;
        const cy = h / 2;
        const r = w / 2;
        let color = node.getColor();

        // Apply tint for completed/error states
        if (this.progressDimmingEnabled) {
            if (node.runState === 'completed') {
                color = this._blendColor(color, this.colors.success, 0.3);
            } else if (node.runState === 'error') {
                color = this._blendColor(color, this.colors.error, 0.3);
            }
        }

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

        // Status badges
        if (node.runState === 'completed') {
            this.renderBadge(group, w - 8, 8, 'check', this.colors.success);
        } else if (node.runState === 'error') {
            this.renderBadge(group, w - 8, 8, 'close', this.colors.error);
        } else if (node.runState === 'waiting') {
            this.renderBadge(group, w - 8, 8, 'hourglass_empty', this.colors.tertiary);
        }
    }

    renderCollapsedNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        let color = node.getColor();

        // Apply tint for completed/error states
        if (this.progressDimmingEnabled) {
            if (node.runState === 'completed') {
                color = this._blendColor(color, this.colors.success, 0.3);
            } else if (node.runState === 'error') {
                color = this._blendColor(color, this.colors.error, 0.3);
            }
        }

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

        // Status badges
        if (node.runState === 'completed') {
            this.renderBadge(group, w - 4, 4, 'check', this.colors.success);
        } else if (node.runState === 'error') {
            this.renderBadge(group, w - 4, 4, 'close', this.colors.error);
        } else if (node.runState === 'waiting') {
            this.renderBadge(group, w - 4, 4, 'hourglass_empty', this.colors.tertiary);
        }
    }

    renderExpandedNode(group, node) {
        const w = node.getWidth();
        const h = node.getHeight();
        const headerHeight = 28;
        let color = node.getColor();

        // Apply tint for completed/error states
        if (this.progressDimmingEnabled) {
            if (node.runState === 'completed') {
                color = this._blendColor(color, this.colors.success, 0.3);
            } else if (node.runState === 'error') {
                color = this._blendColor(color, this.colors.error, 0.3);
            }
        }

        // Background
        const bg = this.createRect(0, 0, w, h, 4, this.colors.surface);
        bg.setAttribute('stroke', this.colors.outline);
        bg.setAttribute('stroke-width', '1');

        if (node.selected) {
            bg.setAttribute('filter', 'url(#selectShadow)');
        } else if (node.runState === 'active' || node.runState === 'waiting') {
            bg.setAttribute('filter', 'url(#glow)');
        }
        group.appendChild(bg);

        // Subtle separator line at header bottom
        const lineHighlight = this.createRect(0, headerHeight - 1, w, 1, 0, 'rgba(255,255,255,0.1)');
        group.appendChild(lineHighlight);
        const lineShadow = this.createRect(0, headerHeight, w, 1, 0, 'rgba(0,0,0,0.3)');
        group.appendChild(lineShadow);

        // Icon (colored with node color)
        const icon = this.createText(14, headerHeight / 2, node.getIcon(), color, '16px');
        icon.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(icon);

        // Title
        const title = this.createText(30, headerHeight / 2, node.getDisplayTitle(), this.colors.onSurface, '12px');
        title.setAttribute('text-anchor', 'start');
        title.setAttribute('font-weight', '500');
        group.appendChild(title);

        // Preview text (centered and bold, large)
        if (typeof node.getPreviewText === 'function') {
            const preview = this.createText(w / 2, headerHeight + 28, node.getPreviewText(), this.colors.onSurfaceVariant, '22px');
            preview.setAttribute('text-anchor', 'middle');
            preview.setAttribute('font-weight', '600');
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

        // Status badges
        if (node.runState === 'completed') {
            this.renderBadge(group, w - 8, 8, 'check', this.colors.success);
        } else if (node.runState === 'error') {
            this.renderBadge(group, w - 8, 8, 'close', this.colors.error);
        } else if (node.runState === 'waiting') {
            this.renderBadge(group, w - 8, 8, 'hourglass_empty', this.colors.tertiary);
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

    renderBadge(group, x, y, icon, color) {
        const circle = this.createCircle(x, y, 10, color, 'none');
        group.appendChild(circle);

        const iconEl = this.createText(x, y, icon, '#FFFFFF', '14px');
        iconEl.setAttribute('font-family', 'Material Symbols Outlined');
        group.appendChild(iconEl);
    }

    _blendColor(color1, color2, ratio) {
        // Parse hex colors
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');

        const r1 = parseInt(hex1.substring(0, 2), 16);
        const g1 = parseInt(hex1.substring(2, 4), 16);
        const b1 = parseInt(hex1.substring(4, 6), 16);

        const r2 = parseInt(hex2.substring(0, 2), 16);
        const g2 = parseInt(hex2.substring(2, 4), 16);
        const b2 = parseInt(hex2.substring(4, 6), 16);

        const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
        const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
        const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

        const isInsertTarget = this.insertTargetConnection &&
                               this.insertTargetConnection.id === conn.id;

        const d = this.createBezierPath(fromPos, toPos);
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');

        // Apply progress dimming styles for connections
        if (this.progressDimmingEnabled) {
            const opacity = this._getConnectionOpacity(conn.runState);
            path.setAttribute('opacity', opacity);

            if (conn.runState === 'idle') {
                path.setAttribute('stroke', this.colors.outline);
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke-dasharray', '6,4');
            } else if (conn.runState === 'active') {
                path.setAttribute('stroke', this.colors.primary);
                path.setAttribute('stroke-width', '3');
                path.removeAttribute('stroke-dasharray');
            } else if (conn.runState === 'completed') {
                path.setAttribute('stroke', this.colors.primary);
                path.setAttribute('stroke-width', '2');
                path.removeAttribute('stroke-dasharray');
            }

            // Render message dot for active connections
            if (conn.runState === 'active') {
                this.renderMessageDot(conn, fromPos, toPos);
            } else {
                this.removeMessageDot(conn.id);
            }
        } else {
            path.setAttribute('opacity', '1');
            path.setAttribute('stroke', isInsertTarget ? '#FFD54F' : this.colors.primary);
            path.setAttribute('stroke-width', isInsertTarget ? '4' : '2');

            if (isInsertTarget) {
                path.setAttribute('stroke-dasharray', '8,4');
            } else {
                path.removeAttribute('stroke-dasharray');
            }

            this.removeMessageDot(conn.id);
        }
    }

    _getConnectionOpacity(runState) {
        switch (runState) {
            case 'idle': return 0.3;
            case 'active':
            case 'completed':
                return 1;
            default: return 1;
        }
    }

    renderMessageDot(conn, fromPos, toPos) {
        let dot = this.messageDots.get(conn.id);
        if (!dot) {
            dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', '6');
            dot.setAttribute('fill', this.colors.tertiary);
            dot.classList.add('message-dot');
            this.overlayLayer.appendChild(dot);
            this.messageDots.set(conn.id, dot);
        }

        // Calculate position along bezier curve based on progress
        const progress = conn.messageProgress || 0;
        const point = this._getBezierPointAtProgress(fromPos, toPos, progress);
        dot.setAttribute('cx', point.x);
        dot.setAttribute('cy', point.y);
    }

    removeMessageDot(connId) {
        const dot = this.messageDots.get(connId);
        if (dot) {
            dot.remove();
            this.messageDots.delete(connId);
        }
    }

    _getBezierPointAtProgress(from, to, t) {
        const dy = to.y - from.y;
        const curvature = Math.min(Math.max(dy * 0.5, 50), 150);

        const p0 = from;
        const p1 = { x: from.x, y: from.y + curvature };
        const p2 = { x: to.x, y: to.y - curvature };
        const p3 = to;

        return this._bezierPoint(t, p0, p1, p2, p3);
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
        let rect = this.screenLayer.querySelector('.selection-box');

        if (!this.selectionBox) {
            if (rect) rect.remove();
            return;
        }

        if (!rect) {
            rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('selection-box');
            this.screenLayer.appendChild(rect);
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

    createLine(x1, y1, x2, y2, stroke, strokeWidth) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', stroke);
        line.setAttribute('stroke-width', strokeWidth);
        return line;
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
        const threshold = 15; // Distance threshold in pixels

        for (const conn of connections.values()) {
            const fromNode = nodes.get(conn.fromNodeId);
            const toNode = nodes.get(conn.toNodeId);
            if (!fromNode || !toNode) continue;

            const from = fromNode.getPortPosition(conn.fromPortId, false);
            const to = toNode.getPortPosition(conn.toPortId, true);

            // Sample points along the bezier curve and check distance
            if (this._pointNearBezier(worldX, worldY, from, to, threshold)) {
                return conn;
            }
        }
        return null;
    }

    _pointNearBezier(px, py, from, to, threshold) {
        // Get control points for the bezier curve (same as createBezierPath)
        const dy = to.y - from.y;
        const curvature = Math.min(Math.max(dy * 0.5, 50), 150);

        const p0 = from;
        const p1 = { x: from.x, y: from.y + curvature };
        const p2 = { x: to.x, y: to.y - curvature };
        const p3 = to;

        // Sample along the curve
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = this._bezierPoint(t, p0, p1, p2, p3);
            const dx = px - point.x;
            const dy = py - point.y;
            if (dx * dx + dy * dy < threshold * threshold) {
                return true;
            }
        }
        return false;
    }

    _bezierPoint(t, p0, p1, p2, p3) {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        return {
            x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        };
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

    setInsertTargetConnection(conn) {
        this.insertTargetConnection = conn;
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
