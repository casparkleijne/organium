/**
 * QueueNode - queues messages until a threshold is reached, then releases them
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class QueueNode extends BaseNode {
    static type = 'queue';
    static category = 'Logic';
    static displayName = 'Queue';
    static icon = 'queue';
    static color = '#FFB74D'; // Orange - logic

    static propertySchema = [
        { key: 'size', type: 'number', label: 'Queue size', defaultValue: 5, min: 1, max: 100 },
        { key: 'releaseMode', type: 'select', label: 'Release mode', defaultValue: 'all', options: [
            { value: 'all', label: 'All at once' },
            { value: 'one', label: 'One by one' }
        ]}
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this._queue = [];
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    // Queue doesn't use enrich in the normal way - executor handles it specially
    enrich(message) {
        const size = this.properties.size || 5;
        this._queue.push(message);

        if (this._queue.length >= size) {
            // Queue is full, release messages
            const messages = [...this._queue];
            this._queue = [];

            return {
                message: message.withPath(this.id),
                outputPort: 'output',
                delay: 0,
                queue: {
                    messages: messages,
                    releaseMode: this.properties.releaseMode || 'all'
                }
            };
        }

        // Queue not full yet, hold the message
        return {
            message: message.withPath(this.id),
            outputPort: null, // Don't forward yet
            delay: 0,
            queued: true
        };
    }

    getQueueLength() {
        return this._queue.length;
    }

    getPreviewText() {
        const size = this.properties.size || 5;
        return `${this._queue.length}/${size}`;
    }

    resetRunState() {
        super.resetRunState();
        this._queue = [];
    }
}

NodeRegistry.register(QueueNode);
