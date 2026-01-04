/**
 * RepeaterNode - repeats a message multiple times
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class RepeaterNode extends BaseNode {
    static type = 'repeater';
    static category = 'Logic';
    static displayName = 'Repeater';
    static icon = 'repeat';
    static color = '#FFB74D'; // Orange - logic

    static propertySchema = [
        { key: 'count', type: 'number', label: 'Repeat count', defaultValue: 3, min: 1, max: 100 },
        { key: 'delay', type: 'number', label: 'Delay (ms)', defaultValue: 0, min: 0, max: 10000 }
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this._currentRepeat = 0;
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    enrich(message) {
        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0,
            repeat: {
                count: this.properties.count || 3,
                delay: this.properties.delay || 0
            }
        };
    }

    setCurrentRepeat(n) {
        this._currentRepeat = n;
    }

    getPreviewText() {
        const count = this.properties.count || 3;
        if (this._currentRepeat > 0) {
            return `${this._currentRepeat}/${count}`;
        }
        return `${count}x`;
    }

    resetRunState() {
        super.resetRunState();
        this._currentRepeat = 0;
    }
}

NodeRegistry.register(RepeaterNode);
