/**
 * DecisionNode - routes message based on condition
 */
import { LogicNode } from '../abstract/logic-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class DecisionNode extends LogicNode {
    static type = 'decision';
    static category = 'Logic';
    static displayName = 'Decision';
    static icon = 'call_split';
    static color = '#E37434';

    static propertySchema = [
        {
            key: 'mode',
            type: 'select',
            label: 'Mode',
            defaultValue: 'compare',
            options: [
                { value: 'compare', label: 'Compare values' },
                { value: 'expression', label: 'Expression' }
            ]
        },
        { key: 'keyA', type: 'variable-select', label: 'Key A', defaultValue: '' },
        {
            key: 'comparator',
            type: 'select',
            label: 'Comparator',
            defaultValue: '==',
            options: [
                { value: '==', label: '== Equal' },
                { value: '!=', label: '!= Not equal' },
                { value: '<', label: '< Less than' },
                { value: '>', label: '> Greater than' },
                { value: '<=', label: '<= Less or equal' },
                { value: '>=', label: '>= Greater or equal' }
            ]
        },
        { key: 'keyB', type: 'variable-select', label: 'Key B / Value', defaultValue: '' },
        { key: 'expression', type: 'string', label: 'Expression', defaultValue: 'payload.value > 0', placeholder: 'JavaScript expression' }
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [
        { id: 'yes', label: 'Yes', position: 'bottom' },
        { id: 'no', label: 'No', position: 'bottom' }
    ];

    getHeight() {
        return this.collapsed ? 56 : 130;
    }

    enrich(message) {
        const mode = this.properties.mode || 'compare';
        let result = false;
        let expression = '';

        if (mode === 'compare') {
            const keyA = this.properties.keyA || 'a';
            const keyB = this.properties.keyB || '0';
            const comparator = this.properties.comparator || '==';

            let valueA = message.getPayloadValue(keyA);
            let valueB = message.hasPayloadKey(keyB) ? message.getPayloadValue(keyB) : keyB;

            // Try to parse as number if possible
            if (!isNaN(valueB)) valueB = Number(valueB);
            if (!isNaN(valueA)) valueA = Number(valueA);

            expression = `${keyA}(${valueA}) ${comparator} ${keyB}(${valueB})`;

            switch (comparator) {
                case '==': result = valueA == valueB; break;
                case '!=': result = valueA != valueB; break;
                case '<': result = valueA < valueB; break;
                case '>': result = valueA > valueB; break;
                case '<=': result = valueA <= valueB; break;
                case '>=': result = valueA >= valueB; break;
                default: result = false;
            }
        } else {
            // Expression mode - limited safe evaluation
            expression = this.properties.expression || 'true';
            try {
                const payload = message.payload;
                // Very limited expression evaluation for safety
                result = this._safeEvaluate(expression, payload);
            } catch (e) {
                console.error('Decision expression error:', e);
                result = false;
            }
        }

        const takenPath = result ? 'yes' : 'no';

        return {
            message: message.withPath(this.id).withPayload({
                [`_decision_${this.id}`]: {
                    expression: expression,
                    result: result,
                    takenPath: takenPath
                }
            }),
            outputPort: takenPath,
            delay: 0
        };
    }

    _safeEvaluate(expression, payload) {
        // Simple safe evaluation for basic expressions
        // Replace payload references with actual values
        let evalStr = expression;

        // Replace payload.key with actual values
        const payloadPattern = /payload\.(\w+)/g;
        evalStr = evalStr.replace(payloadPattern, (match, key) => {
            const value = payload[key];
            if (typeof value === 'string') return `"${value}"`;
            return value;
        });

        // Only allow safe operations
        if (/[^0-9+\-*/<>=!&|()."\s\w]/.test(evalStr)) {
            throw new Error('Unsafe expression');
        }

        // Use Function constructor for sandboxed evaluation
        return new Function(`return ${evalStr}`)();
    }

    getPreviewText() {
        const mode = this.properties.mode || 'compare';
        if (mode === 'compare') {
            return `${this.properties.keyA} ${this.properties.comparator} ${this.properties.keyB}`;
        }
        return this.properties.expression || 'expression';
    }
}

NodeRegistry.register(DecisionNode);
