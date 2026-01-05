/**
 * DelayNode - delays message propagation
 */
import { FlowNode } from '../abstract/flow-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class DelayNode extends FlowNode {
    static type = 'delay';
    static category = 'Flow';
    static displayName = 'Delay';
    static icon = 'schedule';
    static color = '#42A5F5'; // Blue - flow timing

    static propertySchema = [
        { key: 'ms', type: 'number', label: 'Delay (ms)', defaultValue: 1000, min: 100, step: 100 }
    ];

    constructor(x, y, id) {
        super(x, y, id);
        this.progress = 0;
        this.startTime = null;
    }

    getHeight() {
        return this.collapsed ? 56 : 90;
    }

    enrich(message) {
        const ms = this.properties.ms || 1000;
        const startedAt = Date.now();

        return {
            message: message.withPath(this.id).withPayload({
                [`_delay_${this.id}`]: {
                    ms: ms,
                    startedAt: startedAt,
                    completedAt: null
                }
            }),
            outputPort: 'output',
            delay: ms
        };
    }

    setProgress(progress) {
        this.progress = Math.min(1, Math.max(0, progress));
    }

    resetRunState() {
        super.resetRunState();
        this.progress = 0;
        this.startTime = null;
    }

    getPreviewText() {
        return `${this.properties.ms || 1000}ms`;
    }
}

NodeRegistry.register(DelayNode);
