/**
 * CanvasControls - zoom and view controls
 */

export class CanvasControls {
    constructor(container, store, renderer, panZoomHandler) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;
        this.panZoomHandler = panZoomHandler;

        this.render();
        this._bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="canvas-controls">
                <button class="canvas-btn" id="zoomInBtn" title="Zoom in">
                    <span class="material-symbols-outlined">add</span>
                </button>
                <button class="canvas-btn" id="zoomOutBtn" title="Zoom out">
                    <span class="material-symbols-outlined">remove</span>
                </button>
                <button class="canvas-btn" id="resetZoomBtn" title="Reset zoom">
                    <span class="material-symbols-outlined">reset_image</span>
                </button>
                <button class="canvas-btn" id="fitContentBtn" title="Fit to content">
                    <span class="material-symbols-outlined">fit_screen</span>
                </button>
            </div>
        `;
    }

    _bindEvents() {
        this.container.querySelector('#zoomInBtn').addEventListener('click', () => {
            this.panZoomHandler.zoomIn();
        });

        this.container.querySelector('#zoomOutBtn').addEventListener('click', () => {
            this.panZoomHandler.zoomOut();
        });

        this.container.querySelector('#resetZoomBtn').addEventListener('click', () => {
            this.panZoomHandler.resetZoom();
        });

        this.container.querySelector('#fitContentBtn').addEventListener('click', () => {
            this.panZoomHandler.fitToContent();
        });
    }
}
