/**
 * ActionNode - represents an action with optional output
 */
import { FlowNode } from '../abstract/flow-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class ActionNode extends FlowNode {
    static type = 'action';
    static category = 'Flow';
    static displayName = 'Action';
    static icon = 'settings';
    static color = '#91C6BC';

    static propertySchema = [
        { key: 'description', type: 'string', label: 'Description', defaultValue: '', placeholder: 'Describe this action' },
        { key: 'outputKey', type: 'string', label: 'Output key (optional)', defaultValue: '', placeholder: 'Leave empty for no output' }
    ];

    getHeight() {
        return this.collapsed ? 56 : 100;
    }

    enrich(message) {
        const outputKey = this.properties.outputKey;
        const description = this.properties.description;

        if (outputKey) {
            return {
                message: message.withPath(this.id).withPayload({
                    [outputKey]: {
                        action: description,
                        executedAt: Date.now()
                    }
                }),
                outputPort: 'output',
                delay: 0
            };
        }

        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0
        };
    }

    getPreviewText() {
        return this.properties.description || 'No description';
    }
}

NodeRegistry.register(ActionNode);
