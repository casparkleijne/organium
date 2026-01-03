/**
 * RunControls - workflow execution controls
 */

export class RunControls {
    constructor(container, store, executor) {
        this.container = container;
        this.store = store;
        this.executor = executor;

        this.render();
        this._bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="run-controls">
                <button class="run-btn" id="playPauseBtn" title="Run/Pause (R)">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>
                <button class="run-btn" id="stepBtn" title="Step (S)">
                    <span class="material-symbols-outlined">skip_next</span>
                </button>
                <button class="run-btn" id="stopBtn" title="Stop">
                    <span class="material-symbols-outlined">stop</span>
                </button>
                <div class="run-status">
                    <span class="status-indicator"></span>
                    <span class="status-text">Idle</span>
                </div>
                <div class="speed-control">
                    <span class="material-symbols-outlined">speed</span>
                    <input type="range" id="speedSlider" min="0.25" max="3" step="0.25" value="1">
                    <span class="speed-value">1x</span>
                </div>
            </div>
        `;

        this.playPauseBtn = this.container.querySelector('#playPauseBtn');
        this.stepBtn = this.container.querySelector('#stepBtn');
        this.stopBtn = this.container.querySelector('#stopBtn');
        this.statusIndicator = this.container.querySelector('.status-indicator');
        this.statusText = this.container.querySelector('.status-text');
        this.speedSlider = this.container.querySelector('#speedSlider');
        this.speedValue = this.container.querySelector('.speed-value');
    }

    _bindEvents() {
        this.playPauseBtn.addEventListener('click', () => {
            if (this.executor.isRunning()) {
                this.executor.pause();
            } else {
                this.executor.start();
            }
        });

        this.stepBtn.addEventListener('click', () => {
            this.executor.step();
        });

        this.stopBtn.addEventListener('click', () => {
            this.executor.stop();
        });

        this.speedSlider.addEventListener('input', () => {
            const speed = parseFloat(this.speedSlider.value);
            this.executor.setSpeed(speed);
            this.speedValue.textContent = `${speed}x`;
        });

        // Listen to executor events
        this.executor.on('started', () => this._updateStatus('running'));
        this.executor.on('paused', () => this._updateStatus('paused'));
        this.executor.on('stopped', () => this._updateStatus('idle'));
        this.executor.on('completed', () => this._updateStatus('completed'));
        this.executor.on('resumed', () => this._updateStatus('running'));
    }

    _updateStatus(status) {
        const icon = this.playPauseBtn.querySelector('.material-symbols-outlined');

        this.statusIndicator.className = 'status-indicator ' + status;

        switch (status) {
            case 'running':
                icon.textContent = 'pause';
                this.statusText.textContent = 'Running';
                break;
            case 'paused':
                icon.textContent = 'play_arrow';
                this.statusText.textContent = 'Paused';
                break;
            case 'completed':
                icon.textContent = 'play_arrow';
                this.statusText.textContent = 'Completed';
                break;
            default:
                icon.textContent = 'play_arrow';
                this.statusText.textContent = 'Idle';
        }
    }
}
