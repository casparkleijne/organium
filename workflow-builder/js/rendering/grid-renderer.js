/**
 * GridRenderer - renders the canvas grid
 */

export class GridRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.gridSize = 20;
        this.showGrid = true;
        this.gridColor = '#1A2120';
        this.gridColorMajor = '#252B2A';
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    setShowGrid(show) {
        this.showGrid = show;
    }

    render(viewport, canvasWidth, canvasHeight) {
        if (!this.showGrid) return;

        const ctx = this.ctx;
        const { panX, panY, zoom } = viewport;

        const scaledGridSize = this.gridSize * zoom;
        if (scaledGridSize < 8) return; // Don't render grid when too zoomed out

        // Calculate visible area in world coordinates
        const startX = Math.floor(-panX / scaledGridSize) * scaledGridSize;
        const startY = Math.floor(-panY / scaledGridSize) * scaledGridSize;
        const endX = startX + canvasWidth / zoom + scaledGridSize * 2;
        const endY = startY + canvasHeight / zoom + scaledGridSize * 2;

        ctx.save();
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1 / zoom;

        // Draw vertical lines
        for (let x = startX; x < endX; x += this.gridSize) {
            const isMajor = x % (this.gridSize * 5) === 0;
            ctx.strokeStyle = isMajor ? this.gridColorMajor : this.gridColor;
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y < endY; y += this.gridSize) {
            const isMajor = y % (this.gridSize * 5) === 0;
            ctx.strokeStyle = isMajor ? this.gridColorMajor : this.gridColor;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        ctx.restore();
    }
}
