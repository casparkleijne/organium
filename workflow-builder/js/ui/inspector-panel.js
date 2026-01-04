/**
 * InspectorPanel - shows live node data when workflow is paused
 */

export class InspectorPanel {
    constructor(container, store, executor) {
        this.container = container;
        this.store = store;
        this.executor = executor;
        this.visible = false;

        this._createPanel();
        this._bindEvents();
    }

    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'inspector-panel';
        this.panel.innerHTML = `
            <div class="inspector-header">
                <span class="material-symbols-outlined">bug_report</span>
                <span>Inspector</span>
                <button class="inspector-close" title="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="inspector-content"></div>
        `;
        this.container.appendChild(this.panel);

        this.content = this.panel.querySelector('.inspector-content');
        this.closeBtn = this.panel.querySelector('.inspector-close');
    }

    _bindEvents() {
        this.closeBtn.addEventListener('click', () => this.hide());

        // Update when store changes (while visible and paused)
        this.store.on('change', () => {
            if (this.visible && this.executor.isPaused()) {
                this._updateContent();
            }
        });
    }

    show() {
        if (!this.executor.isPaused()) return;

        this.visible = true;
        this.panel.classList.add('visible');
        this._updateContent();
    }

    hide() {
        this.visible = false;
        this.panel.classList.remove('visible');
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    _updateContent() {
        const nodes = this.store.getNodes();
        const pendingDelays = this.executor.pendingDelays;
        const activeAnimations = this.executor.activeConnectionAnimations;

        let html = '';

        nodes.forEach(node => {
            const nodeData = this._getNodeData(node, pendingDelays);
            if (nodeData.hasData) {
                html += this._renderNodeCard(node, nodeData);
            }
        });

        if (!html) {
            html = '<div class="inspector-empty">No active data in nodes</div>';
        }

        this.content.innerHTML = html;
    }

    _getNodeData(node, pendingDelays) {
        const data = {
            hasData: false,
            runState: node.runState,
            internalState: {},
            pendingDelay: null
        };

        // Check for pending delay on this node
        pendingDelays.forEach((delay, id) => {
            if (delay.nodeId === node.id) {
                data.pendingDelay = {
                    remaining: Math.round(delay.remaining),
                    total: delay.total,
                    progress: Math.round(delay.progress * 100)
                };
                data.hasData = true;
            }
        });

        // Get node-specific internal state
        const type = node.getType();

        // Queue node
        if (type === 'queue' && node._queue && node._queue.length > 0) {
            data.internalState.queue = node._queue.map((msg, i) => ({
                index: i,
                payload: this._summarizePayload(msg.payload)
            }));
            data.hasData = true;
        }

        // Stack node
        if (type === 'stack' && node._stack && node._stack.length > 0) {
            data.internalState.stack = node._stack.map((msg, i) => ({
                index: i,
                payload: this._summarizePayload(msg.payload)
            }));
            data.hasData = true;
        }

        // Counter node
        if (type === 'counter' && node._count !== null) {
            data.internalState.count = node._count;
            data.hasData = true;
        }

        // AwaitAll node
        if (type === 'awaitall' && node.arrivedMessages && node.arrivedMessages.length > 0) {
            data.internalState.arrived = node.arrivedMessages.length;
            data.internalState.expected = node.expectedCount || '?';
            data.hasData = true;
        }

        // Repeater node
        if (type === 'repeater' && node._currentRepeat) {
            data.internalState.repeat = `${node._currentRepeat}/${node.properties.count || 1}`;
            data.hasData = true;
        }

        // Scheduler node
        if (type === 'scheduler' && node.runCount > 0) {
            data.internalState.runs = node.runCount;
            data.hasData = true;
        }

        // Show waiting/active states
        if (node.runState === 'waiting' || node.runState === 'active') {
            data.hasData = true;
        }

        return data;
    }

    _summarizePayload(payload) {
        const keys = Object.keys(payload).filter(k => !k.startsWith('_'));
        if (keys.length === 0) return '{}';
        if (keys.length <= 3) {
            return keys.map(k => `${k}: ${this._formatValue(payload[k])}`).join(', ');
        }
        return `{${keys.length} keys}`;
    }

    _formatValue(val) {
        if (val === null || val === undefined) return 'null';
        if (typeof val === 'string') return val.length > 20 ? val.substring(0, 17) + '...' : val;
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val;
        if (Array.isArray(val)) return `[${val.length}]`;
        if (typeof val === 'object') return '{...}';
        return String(val);
    }

    _renderNodeCard(node, nodeData) {
        const stateClass = `state-${nodeData.runState}`;

        let stateHtml = '';

        // Run state badge
        if (nodeData.runState !== 'idle') {
            stateHtml += `<span class="inspector-state ${stateClass}">${nodeData.runState}</span>`;
        }

        // Internal state items
        let detailsHtml = '';

        if (nodeData.pendingDelay) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Delay</span>
                    <span class="inspector-value">${nodeData.pendingDelay.remaining}ms (${nodeData.pendingDelay.progress}%)</span>
                </div>
            `;
        }

        if (nodeData.internalState.queue) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Queue</span>
                    <span class="inspector-value">${nodeData.internalState.queue.length} items</span>
                </div>
            `;
            nodeData.internalState.queue.forEach((item, i) => {
                detailsHtml += `
                    <div class="inspector-item inspector-item-nested">
                        <span class="inspector-label">[${i}]</span>
                        <span class="inspector-value">${item.payload}</span>
                    </div>
                `;
            });
        }

        if (nodeData.internalState.stack) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Stack</span>
                    <span class="inspector-value">${nodeData.internalState.stack.length} items</span>
                </div>
            `;
            nodeData.internalState.stack.forEach((item, i) => {
                detailsHtml += `
                    <div class="inspector-item inspector-item-nested">
                        <span class="inspector-label">[${i}]</span>
                        <span class="inspector-value">${item.payload}</span>
                    </div>
                `;
            });
        }

        if (nodeData.internalState.count !== undefined) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Count</span>
                    <span class="inspector-value">${nodeData.internalState.count}</span>
                </div>
            `;
        }

        if (nodeData.internalState.arrived !== undefined) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Arrived</span>
                    <span class="inspector-value">${nodeData.internalState.arrived}/${nodeData.internalState.expected}</span>
                </div>
            `;
        }

        if (nodeData.internalState.repeat) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Repeat</span>
                    <span class="inspector-value">${nodeData.internalState.repeat}</span>
                </div>
            `;
        }

        if (nodeData.internalState.runs !== undefined) {
            detailsHtml += `
                <div class="inspector-item">
                    <span class="inspector-label">Runs</span>
                    <span class="inspector-value">${nodeData.internalState.runs}</span>
                </div>
            `;
        }

        return `
            <div class="inspector-card">
                <div class="inspector-card-header">
                    <span class="inspector-node-title">${node.getDisplayTitle()}</span>
                    ${stateHtml}
                </div>
                <div class="inspector-card-body">
                    ${detailsHtml || '<div class="inspector-item"><span class="inspector-value">--</span></div>'}
                </div>
            </div>
        `;
    }
}
