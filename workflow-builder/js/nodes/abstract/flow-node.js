/**
 * FlowNode - abstract base for simple pass-through nodes
 */
import { BaseNode } from '../../core/base-node.js';

export class FlowNode extends BaseNode {
    static category = 'Flow';
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    enrich(message) {
        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0
        };
    }
}
