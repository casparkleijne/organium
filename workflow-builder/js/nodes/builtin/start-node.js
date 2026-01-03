/**
 * StartNode - initiates workflow with new message
 */
import { BaseNode } from '../../core/base-node.js';
import { Message } from '../../core/message.js';
import { NodeRegistry } from '../../core/registry.js';

export class StartNode extends BaseNode {
    static type = 'start';
    static category = 'Flow Control';
    static displayName = 'Start';
    static icon = 'play_arrow';
    static color = '#91C6BC';

    static propertySchema = [];
    static inputPorts = [];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

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
        // Start creates a new message
        const newMessage = new Message(this.id, {
            _startedAt: Date.now()
        });
        return {
            message: newMessage.withPath(this.id),
            outputPort: 'output',
            delay: 0
        };
    }

    // Override - Start doesn't receive messages, it creates them
    createInitialMessage() {
        return new Message(this.id, { _startedAt: Date.now() });
    }
}

NodeRegistry.register(StartNode);
