/**
 * Geometry utilities
 */

export function pointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.width &&
           py >= rect.y && py <= rect.y + rect.height;
}

export function pointInCircle(px, py, cx, cy, radius) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
}

export function rectsIntersect(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

export function rectContainsRect(outer, inner) {
    return inner.x >= outer.x &&
           inner.y >= outer.y &&
           inner.x + inner.width <= outer.x + outer.width &&
           inner.y + inner.height <= outer.y + outer.height;
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

export function getBezierControlPoints(x1, y1, x2, y2) {
    const midY = (y1 + y2) / 2;
    const offsetY = Math.abs(y2 - y1) * 0.5;
    const cpOffset = Math.max(50, offsetY);

    return {
        cp1x: x1,
        cp1y: y1 + cpOffset,
        cp2x: x2,
        cp2y: y2 - cpOffset
    };
}

export function getPointOnBezier(t, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * x1 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x2,
        y: mt3 * y1 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y2
    };
}

export function distanceToBeizer(px, py, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2, samples = 20) {
    let minDist = Infinity;
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const point = getPointOnBezier(t, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
        const d = distance(px, py, point.x, point.y);
        if (d < minDist) minDist = d;
    }
    return minDist;
}
