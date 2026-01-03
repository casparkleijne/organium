/**
 * ConstantNode - adds a value to message payload
 */
import { DataNode } from '../abstract/data-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class ConstantNode extends DataNode {
    static type = 'constant';
    static category = 'Data';
    static displayName = 'Constant';
    static icon = 'data_object';
    static color = '#26C6DA'; // Cyan - data

    static propertySchema = [
        {
            key: 'dataType',
            type: 'select',
            label: 'Type',
            defaultValue: 'string',
            options: [
                { value: 'string', label: 'String' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' }
            ]
        },
        { key: 'name', type: 'string', label: 'Name', defaultValue: 'value', placeholder: 'Variable name' },
        { key: 'value', type: 'string', label: 'Value', defaultValue: '' },
        { key: 'useRandom', type: 'boolean', label: 'Random value', defaultValue: false },
        { key: 'min', type: 'number', label: 'Min', defaultValue: 0 },
        { key: 'max', type: 'number', label: 'Max', defaultValue: 100 }
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    getHeight() {
        return this.collapsed ? 56 : 120;
    }

    getKeyToAdd() {
        return this.properties.name || 'value';
    }

    getValueToAdd() {
        const type = this.properties.dataType;
        const rawValue = this.properties.value;

        switch (type) {
            case 'number':
                if (this.properties.useRandom === true) {
                    const min = typeof this.properties.min === 'number' ? this.properties.min : 0;
                    const max = typeof this.properties.max === 'number' ? this.properties.max : 100;
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
                return parseFloat(rawValue) || 0;

            case 'boolean':
                return rawValue === 'true' || rawValue === true;

            case 'string':
            default:
                return String(rawValue);
        }
    }

    getPreviewText() {
        const name = this.properties.name || 'value';
        const type = this.properties.dataType;
        if (type === 'number' && this.properties.useRandom) {
            return `${name}: random(${this.properties.min}-${this.properties.max})`;
        }
        return `${name}: ${this.properties.value}`;
    }
}

NodeRegistry.register(ConstantNode);
