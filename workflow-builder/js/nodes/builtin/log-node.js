/**
 * LogNode - logs a value from message payload
 */
import { FlowNode } from '../abstract/flow-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class LogNode extends FlowNode {
    static type = 'log';
    static category = 'Data';
    static displayName = 'Log';
    static icon = 'terminal';
    static color = '#4DB6AC'; // Teal variant - data output

    static propertySchema = [
        { key: 'watchKey', type: 'string', label: 'Watch key', defaultValue: '*', placeholder: '* for entire payload' }
    ];

    constructor(x, y, id) {
        super(x, y, id);
        this.lastValue = null;
    }

    getHeight() {
        return this.collapsed ? 56 : 100;
    }

    enrich(message) {
        const watchKey = this.properties.watchKey || '*';
        let watchedValue;

        if (watchKey === '*') {
            watchedValue = message.payload;
        } else {
            watchedValue = message.getPayloadValue(watchKey);
        }

        this.lastValue = watchedValue;

        return {
            message: message.withPath(this.id).withPayload({
                [`_log_${this.id}`]: {
                    watched: watchKey,
                    value: watchedValue,
                    at: Date.now()
                }
            }),
            outputPort: 'output',
            delay: 0
        };
    }

    getPreviewText() {
        if (this.lastValue !== null) {
            const str = JSON.stringify(this.lastValue);
            return str.length > 30 ? str.substring(0, 27) + '...' : str;
        }
        return `watch: ${this.properties.watchKey || '*'}`;
    }

    resetRunState() {
        super.resetRunState();
        this.lastValue = null;
    }
}

NodeRegistry.register(LogNode);
