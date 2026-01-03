/**
 * DataNode - abstract base for nodes that add data to message
 */
import { BaseNode } from '../../core/base-node.js';

export class DataNode extends BaseNode {
    static category = 'Data';
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    getValueToAdd() {
        // Override in subclass
        return null;
    }

    getKeyToAdd() {
        // Override in subclass
        return null;
    }

    enrich(message) {
        const key = this.getKeyToAdd();
        const value = this.getValueToAdd();

        if (key && value !== undefined) {
            return {
                message: message.withPath(this.id).withPayload({ [key]: value }),
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
}
