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
        { key: 'seconds', type: 'number', label: 'Seconds', defaultValue: 1, min: 0.1, step: 0.1 }
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
        const seconds = this.properties.seconds || 1;
        const startedAt = Date.now();

        return {
            message: message.withPath(this.id).withPayload({
                [`_delay_${this.id}`]: {
                    seconds: seconds,
                    startedAt: startedAt,
                    completedAt: null // Will be set when delay completes
                }
            }),
            outputPort: 'output',
            delay: seconds * 1000
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
        return `${this.properties.seconds}s`;
    }
}

NodeRegistry.register(DelayNode);
