/**
 * AwaitAllNode - waits for all incoming branches
 */
import { LogicNode } from '../abstract/logic-node.js';
import { Message } from '../../core/message.js';
import { NodeRegistry } from '../../core/registry.js';

export class AwaitAllNode extends LogicNode {
    static type = 'awaitall';
    static category = 'Logic';
    static displayName = 'Await All';
    static icon = 'merge';
    static color = '#FFD54F'; // Yellow - merging

    static propertySchema = [];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.expectedCount = 0;
        this.arrivedMessages = [];
    }

    getHeight() {
        return this.collapsed ? 56 : 70;
    }

    setExpectedCount(count) {
        this.expectedCount = count;
    }

    receiveMessage(message) {
        this.arrivedMessages.push(message);
        return this.arrivedMessages.length >= this.expectedCount;
    }

    enrich(message) {
        // AwaitAll merges all arrived messages
        if (this.arrivedMessages.length === 0) {
            this.arrivedMessages.push(message);
        }

        const merged = Message.merge(this.arrivedMessages, this.id);
        const arrivedCount = this.arrivedMessages.length;
        const mergedFrom = this.arrivedMessages.map(m => m.id);

        // Reset for next cycle (allows reuse in loops)
        this.arrivedMessages = [];

        return {
            message: merged.withPath(this.id).withPayload({
                [`_awaitAll_${this.id}`]: {
                    arrivedCount: arrivedCount,
                    mergedFrom: mergedFrom
                }
            }),
            outputPort: 'output',
            delay: 0
        };
    }

    getPreviewText() {
        if (this.expectedCount > 0) {
            return `${this.arrivedMessages.length}/${this.expectedCount} arrived`;
        }
        return 'Await branches';
    }

    resetRunState() {
        super.resetRunState();
        this.expectedCount = 0;
        this.arrivedMessages = [];
    }
}

NodeRegistry.register(AwaitAllNode);
