/**
 * CalculateNode - performs math operations on payload values
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class CalculateNode extends BaseNode {
    static type = 'calculate';
    static category = 'Data';
    static displayName = 'Calculate';
    static icon = 'calculate';
    static color = '#26A69A'; // Teal - data processing

    static propertySchema = [
        {
            key: 'operator',
            type: 'select',
            label: 'Operator',
            defaultValue: '+',
            options: [
                { value: '+', label: '+ Add' },
                { value: '-', label: '- Subtract' },
                { value: '*', label: '× Multiply' },
                { value: '/', label: '÷ Divide' },
                { value: '%', label: '% Modulo' },
                { value: '^', label: '^ Power' }
            ]
        },
        { key: 'inputA', type: 'variable-select', label: 'Input A', defaultValue: '' },
        { key: 'inputB', type: 'variable-select', label: 'Input B', defaultValue: '' },
        { key: 'outputKey', type: 'string', label: 'Output key', defaultValue: 'result', placeholder: 'Result key' }
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.lastResult = null;
    }

    getHeight() {
        return this.collapsed ? 56 : 130;
    }

    enrich(message) {
        const inputAKey = this.properties.inputA || 'a';
        const inputBKey = this.properties.inputB || 'b';
        const operator = this.properties.operator || '+';
        const outputKey = this.properties.outputKey || 'result';

        const a = Number(message.getPayloadValue(inputAKey)) || 0;
        const b = Number(message.getPayloadValue(inputBKey)) || 0;

        let result;
        switch (operator) {
            case '+': result = a + b; break;
            case '-': result = a - b; break;
            case '*': result = a * b; break;
            case '/': result = b !== 0 ? a / b : 0; break;
            case '%': result = b !== 0 ? a % b : 0; break;
            case '^': result = Math.pow(a, b); break;
            default: result = a + b;
        }

        this.lastResult = result;

        return {
            message: message.withPath(this.id).withPayload({
                [outputKey]: result
            }),
            outputPort: 'output',
            delay: 0
        };
    }

    getPreviewText() {
        const op = this.properties.operator || '+';
        const a = this.properties.inputA || 'a';
        const b = this.properties.inputB || 'b';
        return `${a} ${op} ${b}`;
    }

    resetRunState() {
        super.resetRunState();
        this.lastResult = null;
    }
}

NodeRegistry.register(CalculateNode);
