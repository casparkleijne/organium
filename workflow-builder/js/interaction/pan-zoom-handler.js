/**
 * PanZoomHandler - handles canvas panning and zooming
 */

export class PanZoomHandler {
    constructor(store, renderer) {
        this.store = store;
        this.renderer = renderer;

        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.minZoom = 0.2;
        this.maxZoom = 3;
        this.zoomStep = 0.1;
    }

    startPan(x, y) {
        this.isPanning = true;
        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    updatePan(x, y) {
        if (!this.isPanning) return;

        const dx = x - this.lastMouseX;
        const dy = y - this.lastMouseY;

        const viewport = this.store.getViewport();
        this.store.setViewport(
            viewport.panX + dx,
            viewport.panY + dy,
            viewport.zoom
        );

        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    endPan() {
        this.isPanning = false;
    }

    zoom(delta, centerX, centerY) {
        const viewport = this.store.getViewport();
        const zoomFactor = delta > 0 ? (1 - this.zoomStep) : (1 + this.zoomStep);
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, viewport.zoom * zoomFactor));

        if (newZoom === viewport.zoom) return;

        // Zoom towards cursor position
        const worldX = (centerX - viewport.panX) / viewport.zoom;
        const worldY = (centerY - viewport.panY) / viewport.zoom;

        const newPanX = centerX - worldX * newZoom;
        const newPanY = centerY - worldY * newZoom;

        this.store.setViewport(newPanX, newPanY, newZoom);
    }

    zoomIn() {
        const viewport = this.store.getViewport();
        const centerX = this.renderer.canvas.width / 2;
        const centerY = this.renderer.canvas.height / 2;
        this.zoom(-1, centerX, centerY);
    }

    zoomOut() {
        const viewport = this.store.getViewport();
        const centerX = this.renderer.canvas.width / 2;
        const centerY = this.renderer.canvas.height / 2;
        this.zoom(1, centerX, centerY);
    }

    resetZoom() {
        const centerX = this.renderer.canvas.width / 2;
        const centerY = this.renderer.canvas.height / 2;
        this.store.setViewport(centerX - 200, centerY - 200, 1);
    }

    fitToContent() {
        this.renderer.fitToContent(this.store.getNodes());
        const viewport = {
            panX: this.renderer.viewport.panX,
            panY: this.renderer.viewport.panY,
            zoom: this.renderer.viewport.zoom
        };
        this.store.setViewport(viewport.panX, viewport.panY, viewport.zoom);
    }
}
