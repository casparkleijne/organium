/**
 * MinimapRenderer - renders the navigation minimap
 */

export class MinimapRenderer {
    constructor(minimapCanvas) {
        this.canvas = minimapCanvas;
        this.ctx = minimapCanvas.getContext('2d');
        this.width = 180;
        this.height = 120;
        this.padding = 10;

        this.backgroundColor = '#0E1514';
        this.borderColor = '#3F4946';
        this.viewportColor = '#E37434';
        this.nodeColors = new Map();
    }

    render(nodes, connections, viewport, canvasWidth, canvasHeight) {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        // Border
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);

        if (nodes.size === 0) return;

        // Calculate bounds of all nodes
        const bounds = this._calculateBounds(nodes);
        if (!bounds) return;

        // Calculate scale to fit nodes in minimap
        const availWidth = this.width - this.padding * 2;
        const availHeight = this.height - this.padding * 2;
        const scaleX = availWidth / bounds.width;
        const scaleY = availHeight / bounds.height;
        const scale = Math.min(scaleX, scaleY, 0.15); // Max scale to keep nodes small

        const offsetX = this.padding + (availWidth - bounds.width * scale) / 2 - bounds.x * scale;
        const offsetY = this.padding + (availHeight - bounds.height * scale) / 2 - bounds.y * scale;

        // Draw connections (simplified lines)
        ctx.strokeStyle = '#3F4946';
        ctx.lineWidth = 1;
        connections.forEach(conn => {
            const fromNode = nodes.get(conn.fromNodeId);
            const toNode = nodes.get(conn.toNodeId);
            if (!fromNode || !toNode) return;

            const fromX = fromNode.x * scale + offsetX + (fromNode.getWidth() * scale) / 2;
            const fromY = fromNode.y * scale + offsetY + (fromNode.getHeight() * scale);
            const toX = toNode.x * scale + offsetX + (toNode.getWidth() * scale) / 2;
            const toY = toNode.y * scale + offsetY;

            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
        });

        // Draw nodes as colored rectangles
        nodes.forEach(node => {
            const x = node.x * scale + offsetX;
            const y = node.y * scale + offsetY;
            const w = Math.max(4, node.getWidth() * scale);
            const h = Math.max(4, node.getHeight() * scale);

            ctx.fillStyle = node.getColor();
            if (node.isCircular()) {
                ctx.beginPath();
                ctx.arc(x + w / 2, y + h / 2, Math.max(2, w / 2), 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, w, h);
            }
        });

        // Draw viewport indicator
        const vpX = (-viewport.panX / viewport.zoom) * scale + offsetX;
        const vpY = (-viewport.panY / viewport.zoom) * scale + offsetY;
        const vpW = (canvasWidth / viewport.zoom) * scale;
        const vpH = (canvasHeight / viewport.zoom) * scale;

        ctx.strokeStyle = this.viewportColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(vpX, vpY, vpW, vpH);
    }

    _calculateBounds(nodes) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.getWidth());
            maxY = Math.max(maxY, node.y + node.getHeight());
        });

        if (minX === Infinity) return null;

        // Add some padding
        const padding = 100;
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        };
    }

    screenToWorld(screenX, screenY, nodes, viewport, canvasWidth, canvasHeight) {
        // Convert minimap click to world coordinates
        const bounds = this._calculateBounds(nodes);
        if (!bounds) return null;

        const availWidth = this.width - this.padding * 2;
        const availHeight = this.height - this.padding * 2;
        const scaleX = availWidth / bounds.width;
        const scaleY = availHeight / bounds.height;
        const scale = Math.min(scaleX, scaleY, 0.15);

        const offsetX = this.padding + (availWidth - bounds.width * scale) / 2 - bounds.x * scale;
        const offsetY = this.padding + (availHeight - bounds.height * scale) / 2 - bounds.y * scale;

        const worldX = (screenX - offsetX) / scale;
        const worldY = (screenY - offsetY) / scale;

        return { x: worldX, y: worldY };
    }
}
