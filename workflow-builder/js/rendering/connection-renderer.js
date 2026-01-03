/**
 * ConnectionRenderer - renders connections between nodes
 */
import { getBezierControlPoints, getPointOnBezier } from '../utils/geometry.js';
import { withAlpha } from '../utils/colors.js';

export class ConnectionRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.connectionColor = '#91C6BC';
        this.connectionWidth = 2;
        this.hoverWidth = 3;
        this.messageColor = '#FFFFFF';
        this.messageRadius = 6;
    }

    render(connections, nodes, hoveredConnection = null, executionState = null) {
        const ctx = this.ctx;

        connections.forEach(conn => {
            const fromNode = nodes.get(conn.fromNodeId);
            const toNode = nodes.get(conn.toNodeId);

            if (!fromNode || !toNode) return;

            const fromPos = fromNode.getPortPosition(conn.fromPortId, false);
            const toPos = toNode.getPortPosition(conn.toPortId, true);

            const isHovered = hoveredConnection && hoveredConnection.id === conn.id;
            this._renderConnection(fromPos, toPos, isHovered);

            // Render message animation if executing
            if (executionState && executionState.messagePositions) {
                const msgPos = executionState.messagePositions.get(conn.id);
                if (msgPos !== undefined) {
                    this._renderMessage(fromPos, toPos, msgPos);
                }
            }
        });
    }

    renderTempConnection(fromPos, toPos) {
        const ctx = this.ctx;
        const cp = getBezierControlPoints(fromPos.x, fromPos.y, toPos.x, toPos.y);

        ctx.save();
        ctx.strokeStyle = withAlpha(this.connectionColor, 0.6);
        ctx.lineWidth = this.connectionWidth;
        ctx.setLineDash([8, 4]);

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, toPos.x, toPos.y);
        ctx.stroke();

        ctx.restore();
    }

    _renderConnection(fromPos, toPos, isHovered) {
        const ctx = this.ctx;
        const cp = getBezierControlPoints(fromPos.x, fromPos.y, toPos.x, toPos.y);

        ctx.save();

        if (isHovered) {
            // Glow effect
            ctx.strokeStyle = withAlpha(this.connectionColor, 0.3);
            ctx.lineWidth = this.hoverWidth + 4;
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, toPos.x, toPos.y);
            ctx.stroke();
        }

        ctx.strokeStyle = isHovered ? '#B1CCC5' : this.connectionColor;
        ctx.lineWidth = isHovered ? this.hoverWidth : this.connectionWidth;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, toPos.x, toPos.y);
        ctx.stroke();

        ctx.restore();
    }

    _renderMessage(fromPos, toPos, progress) {
        const ctx = this.ctx;
        const cp = getBezierControlPoints(fromPos.x, fromPos.y, toPos.x, toPos.y);
        const point = getPointOnBezier(progress, fromPos.x, fromPos.y, cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, toPos.x, toPos.y);

        ctx.save();

        // Glow
        ctx.fillStyle = withAlpha(this.messageColor, 0.3);
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.messageRadius + 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = this.messageColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.messageRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getConnectionAt(x, y, connections, nodes, threshold = 10) {
        for (const conn of connections.values()) {
            const fromNode = nodes.get(conn.fromNodeId);
            const toNode = nodes.get(conn.toNodeId);

            if (!fromNode || !toNode) continue;

            const fromPos = fromNode.getPortPosition(conn.fromPortId, false);
            const toPos = toNode.getPortPosition(conn.toPortId, true);

            if (this._distanceToConnection(x, y, fromPos, toPos) < threshold) {
                return conn;
            }
        }
        return null;
    }

    _distanceToConnection(px, py, fromPos, toPos) {
        const cp = getBezierControlPoints(fromPos.x, fromPos.y, toPos.x, toPos.y);
        let minDist = Infinity;

        for (let t = 0; t <= 1; t += 0.05) {
            const point = getPointOnBezier(t, fromPos.x, fromPos.y, cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, toPos.x, toPos.y);
            const dx = px - point.x;
            const dy = py - point.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
        }

        return minDist;
    }
}
