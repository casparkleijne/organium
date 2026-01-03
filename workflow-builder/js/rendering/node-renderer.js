/**
 * NodeRenderer - renders nodes on the canvas
 */
import { withAlpha, getContrastColor } from '../utils/colors.js';

export class NodeRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.portRadius = 7;
        this.portHoverRadius = 10;

        // M3 Colors
        this.surfaceContainer = '#1A2120';
        this.surfaceContainerHigh = '#252B2A';
        this.outlineVariant = '#3F4946';
        this.onSurface = '#DEE4E1';
        this.onSurfaceVariant = '#BEC9C5';
        this.primary = '#91C6BC';
    }

    render(node, hoveredPort = null) {
        if (node.isCircular()) {
            this._renderCircularNode(node);
        } else if (node.collapsed) {
            this._renderCollapsedNode(node);
        } else {
            this._renderExpandedNode(node, hoveredPort);
        }
    }

    _renderCircularNode(node) {
        const ctx = this.ctx;
        const bounds = node.getBounds();
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const radius = bounds.width / 2;

        ctx.save();

        // Gradient fill
        const gradient = ctx.createRadialGradient(cx, cy - radius * 0.3, 0, cx, cy, radius);
        const color = node.getColor();

        if (node.getType() === 'start') {
            gradient.addColorStop(0, '#91C6BC');
            gradient.addColorStop(1, '#00504A');
        } else if (node.getType() === 'end') {
            gradient.addColorStop(0, '#E37434');
            gradient.addColorStop(1, '#5C3A1A');
        } else {
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, withAlpha(color, 0.6));
        }

        // Selection glow
        if (node.selected) {
            ctx.shadowColor = this.primary;
            ctx.shadowBlur = 12;
        }

        // Active glow
        if (node.runState === 'active') {
            ctx.shadowColor = node.getColor();
            ctx.shadowBlur = 16 + Math.sin(Date.now() / 200) * 4;
        }

        // Circle
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Selection border
        if (node.selected) {
            ctx.strokeStyle = this.primary;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // Icon
        const iconSize = node.collapsed ? 24 : 32;
        ctx.fillStyle = getContrastColor(color);
        ctx.font = `${iconSize}px "Material Symbols Outlined"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.getIcon(), cx, cy);

        // Ports
        this._renderPorts(node);

        // Completed badge
        if (node.runState === 'completed') {
            this._renderCompletedBadge(bounds.x + bounds.width - 8, bounds.y + 8);
        }

        ctx.restore();
    }

    _renderCollapsedNode(node) {
        const ctx = this.ctx;
        const bounds = node.getBounds();
        const color = node.getColor();

        ctx.save();

        // Selection glow
        if (node.selected) {
            ctx.shadowColor = this.primary;
            ctx.shadowBlur = 12;
        }

        // Active glow
        if (node.runState === 'active') {
            ctx.shadowColor = color;
            ctx.shadowBlur = 16 + Math.sin(Date.now() / 200) * 4;
        }

        // Background
        ctx.fillStyle = this.surfaceContainer;
        this._roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 12);
        ctx.fill();

        // Border
        ctx.strokeStyle = node.selected ? this.primary : this.outlineVariant;
        ctx.lineWidth = node.selected ? 2 : 1;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Inner circle with color
        const innerRadius = 18;
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.fillStyle = getContrastColor(color);
        ctx.font = '24px "Material Symbols Outlined"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.getIcon(), cx, cy);

        // Ports
        this._renderPorts(node);

        // Completed badge
        if (node.runState === 'completed') {
            this._renderCompletedBadge(bounds.x + bounds.width - 4, bounds.y + 4);
        }

        ctx.restore();
    }

    _renderExpandedNode(node, hoveredPort) {
        const ctx = this.ctx;
        const bounds = node.getBounds();
        const color = node.getColor();
        const headerHeight = 48;

        ctx.save();

        // Selection glow
        if (node.selected) {
            ctx.shadowColor = this.primary;
            ctx.shadowBlur = 12;
        }

        // Active glow
        if (node.runState === 'active') {
            ctx.shadowColor = color;
            ctx.shadowBlur = 16 + Math.sin(Date.now() / 200) * 4;
        }

        // Background
        ctx.fillStyle = this.surfaceContainer;
        this._roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 16);
        ctx.fill();

        // Border
        ctx.strokeStyle = node.selected ? this.primary : this.outlineVariant;
        ctx.lineWidth = node.selected ? 2 : 1;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Header
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bounds.x, bounds.y, bounds.width, headerHeight, [16, 16, 0, 0]);
        ctx.fill();

        // Divider
        ctx.strokeStyle = this.outlineVariant;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bounds.x, bounds.y + headerHeight);
        ctx.lineTo(bounds.x + bounds.width, bounds.y + headerHeight);
        ctx.stroke();

        // Icon in header
        const iconX = bounds.x + 20;
        const iconY = bounds.y + headerHeight / 2;
        ctx.fillStyle = getContrastColor(color);
        ctx.font = '24px "Material Symbols Outlined"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.getIcon(), iconX, iconY);

        // Title in header
        ctx.fillStyle = getContrastColor(color);
        ctx.font = '500 14px Roboto';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.getDisplayTitle(), bounds.x + 40, iconY);

        // Body content (preview text)
        if (typeof node.getPreviewText === 'function') {
            const preview = node.getPreviewText();
            ctx.fillStyle = this.onSurfaceVariant;
            ctx.font = '400 12px Roboto';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Truncate if needed
            const maxWidth = bounds.width - 32;
            let displayText = preview;
            if (ctx.measureText(preview).width > maxWidth) {
                while (ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
                    displayText = displayText.slice(0, -1);
                }
                displayText += '...';
            }

            ctx.fillText(displayText, bounds.x + 16, bounds.y + headerHeight + 12);
        }

        // Delay progress bar
        if (node.getType() === 'delay' && node.runState === 'active' && node.progress > 0) {
            const barY = bounds.y + bounds.height - 8;
            const barWidth = bounds.width - 32;
            const barX = bounds.x + 16;

            // Background
            ctx.fillStyle = this.outlineVariant;
            this._roundRect(barX, barY, barWidth, 4, 2);
            ctx.fill();

            // Progress
            ctx.fillStyle = this.primary;
            this._roundRect(barX, barY, barWidth * node.progress, 4, 2);
            ctx.fill();
        }

        // Ports
        this._renderPorts(node, hoveredPort);

        // Completed badge
        if (node.runState === 'completed') {
            this._renderCompletedBadge(bounds.x + bounds.width - 8, bounds.y + 8);
        }

        // Hover state layer
        if (node.hovered && !node.selected) {
            ctx.fillStyle = withAlpha(this.onSurface, 0.08);
            this._roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 16);
            ctx.fill();
        }

        ctx.restore();
    }

    _renderPorts(node, hoveredPort = null) {
        const ctx = this.ctx;
        const inputPorts = node.getInputPorts();
        const outputPorts = node.getOutputPorts();

        const renderPort = (port, isInput) => {
            const pos = node.getPortPosition(port.id, isInput);
            const isHovered = hoveredPort && hoveredPort.nodeId === node.id &&
                             hoveredPort.portId === port.id && hoveredPort.isInput === isInput;
            const radius = isHovered ? this.portHoverRadius : this.portRadius;

            // Port circle
            ctx.fillStyle = this.surfaceContainerHigh;
            ctx.strokeStyle = isHovered ? this.primary : this.outlineVariant;
            ctx.lineWidth = isHovered ? 2 : 1;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (isHovered) {
                ctx.fillStyle = withAlpha(this.primary, 0.3);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // Port label for multiple ports
            if (port.label && !node.collapsed) {
                ctx.fillStyle = this.onSurfaceVariant;
                ctx.font = '500 11px Roboto';
                ctx.textAlign = 'center';
                ctx.textBaseline = isInput ? 'bottom' : 'top';
                const labelY = isInput ? pos.y - radius - 4 : pos.y + radius + 4;
                ctx.fillText(port.label, pos.x, labelY);
            }
        };

        inputPorts.forEach(port => renderPort(port, true));
        outputPorts.forEach(port => renderPort(port, false));
    }

    _renderCompletedBadge(x, y) {
        const ctx = this.ctx;

        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px "Material Symbols Outlined"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('check', x, y);
    }

    _roundRect(x, y, width, height, radius) {
        const ctx = this.ctx;
        if (typeof radius === 'number') {
            radius = [radius, radius, radius, radius];
        }
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
    }

    getPortAt(x, y, nodes) {
        for (const node of nodes.values()) {
            const inputPorts = node.getInputPorts();
            const outputPorts = node.getOutputPorts();

            for (const port of inputPorts) {
                const pos = node.getPortPosition(port.id, true);
                const dx = x - pos.x;
                const dy = y - pos.y;
                if (dx * dx + dy * dy <= this.portRadius * this.portRadius * 2) {
                    return { nodeId: node.id, portId: port.id, isInput: true, position: pos };
                }
            }

            for (const port of outputPorts) {
                const pos = node.getPortPosition(port.id, false);
                const dx = x - pos.x;
                const dy = y - pos.y;
                if (dx * dx + dy * dy <= this.portRadius * this.portRadius * 2) {
                    return { nodeId: node.id, portId: port.id, isInput: false, position: pos };
                }
            }
        }
        return null;
    }
}
