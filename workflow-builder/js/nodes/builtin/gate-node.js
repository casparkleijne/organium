/**
 * GateNode - waits for both trigger and data messages
 */
import { LogicNode } from '../abstract/logic-node.js';
import { Message } from '../../core/message.js';
import { NodeRegistry } from '../../core/registry.js';

export class GateNode extends LogicNode {
    static type = 'gate';
    static category = 'Logic';
    static displayName = 'Gate';
    static icon = 'lock_open';
    static color = '#CE93D8';

    static propertySchema = [];
    static inputPorts = [
        { id: 'trigger', label: 'Trigger', position: 'top' },
        { id: 'data', label: 'Data', position: 'top' }
    ];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.triggerMessage = null;
        this.dataMessage = null;
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    receiveTrigger(message) {
        this.triggerMessage = message;
        return this.isReady();
    }

    receiveData(message) {
        this.dataMessage = message;
        return this.isReady();
    }

    isReady() {
        return this.triggerMessage !== null && this.dataMessage !== null;
    }

    enrich(message) {
        // Gate merges trigger and data messages
        if (!this.isReady()) {
            return null; // Still waiting
        }

        const merged = Message.merge([this.triggerMessage, this.dataMessage], this.id);

        return {
            message: merged.withPath(this.id).withPayload({
                [`_gate_${this.id}`]: {
                    triggeredAt: Date.now(),
                    mergedFrom: [this.triggerMessage.id, this.dataMessage.id]
                }
            }),
            outputPort: 'output',
            delay: 0
        };
    }

    getPreviewText() {
        const hasTrigger = this.triggerMessage !== null;
        const hasData = this.dataMessage !== null;

        if (hasTrigger && hasData) return 'Ready';
        if (hasTrigger) return 'Waiting: data';
        if (hasData) return 'Waiting: trigger';
        return 'Waiting: trigger + data';
    }

    resetRunState() {
        super.resetRunState();
        this.triggerMessage = null;
        this.dataMessage = null;
    }
}

NodeRegistry.register(GateNode);
