/**
 * CounterNode - counts messages passing through
 */
import { DataNode } from '../abstract/data-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class CounterNode extends DataNode {
    static type = 'counter';
    static category = 'Data';
    static displayName = 'Counter';
    static icon = 'tag';
    static color = '#00ACC1'; // Cyan variant - data counting

    static propertySchema = [
        { key: 'name', type: 'string', label: 'Name', defaultValue: 'count', placeholder: 'Variable name' },
        { key: 'start', type: 'number', label: 'Start value', defaultValue: 0 },
        { key: 'step', type: 'number', label: 'Step', defaultValue: 1 }
    ];

    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y) {
        super(x, y);
        this._count = null; // Will be initialized on first use
    }

    getHeight() {
        return this.collapsed ? 56 : 100;
    }

    resetRunState() {
        super.resetRunState();
        this._count = null; // Reset counter when workflow resets
    }

    getKeyToAdd() {
        return this.properties.name || 'count';
    }

    getValueToAdd() {
        // Initialize on first call
        if (this._count === null) {
            this._count = this.properties.start || 0;
        } else {
            this._count += (this.properties.step || 1);
        }
        return this._count;
    }

    getPreviewText() {
        const name = this.properties.name || 'count';
        const current = this._count !== null ? this._count : this.properties.start || 0;
        return `${name}: ${current}`;
    }
}

NodeRegistry.register(CounterNode);
