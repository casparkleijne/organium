/**
 * StackNode - stacks messages (LIFO) until a threshold is reached, then releases them
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class StackNode extends BaseNode {
    static type = 'stack';
    static category = 'Logic';
    static displayName = 'Stack';
    static icon = 'layers';
    static color = '#FFB74D'; // Orange - logic

    static propertySchema = [
        { key: 'size', type: 'number', label: 'Stack size', defaultValue: 5, min: 1, max: 100 },
        { key: 'releaseMode', type: 'select', label: 'Release mode', defaultValue: 'all', options: [
            { value: 'all', label: 'All at once' },
            { value: 'one', label: 'One by one' }
        ]}
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this._stack = [];
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    enrich(message) {
        const size = this.properties.size || 5;
        this._stack.push(message);

        if (this._stack.length >= size) {
            // Stack is full, release messages in LIFO order (reverse)
            const messages = [...this._stack].reverse();
            this._stack = [];

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

        // Stack not full yet, hold the message
        return {
            message: message.withPath(this.id),
            outputPort: null,
            delay: 0,
            queued: true
        };
    }

    getStackLength() {
        return this._stack.length;
    }

    getPreviewText() {
        const size = this.properties.size || 5;
        return `${this._stack.length}/${size}`;
    }

    resetRunState() {
        super.resetRunState();
        this._stack = [];
    }
}

NodeRegistry.register(StackNode);
