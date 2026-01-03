/**
 * EndNode - terminates workflow
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class EndNode extends BaseNode {
    static type = 'end';
    static category = 'Flow Control';
    static displayName = 'End';
    static icon = 'stop';
    static color = '#E37434';

    static propertySchema = [];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [];

    isCircular() {
        return true;
    }

    getWidth() {
        return this.collapsed ? 56 : 88;
    }

    getHeight() {
        return this.collapsed ? 56 : 88;
    }

    enrich(message) {
        const finalMessage = message.withPath(this.id).withPayload({
            _completedAt: Date.now(),
            _finalPath: [...message.metadata.path, this.id]
        });
        return {
            message: finalMessage,
            outputPort: null, // No output
            delay: 0
        };
    }
}

NodeRegistry.register(EndNode);
