/**
 * SchedulerNode - triggers workflow on interval
 */
import { BaseNode } from '../../core/base-node.js';
import { Message } from '../../core/message.js';
import { NodeRegistry } from '../../core/registry.js';

export class SchedulerNode extends BaseNode {
    static type = 'scheduler';
    static category = 'Flow Control';
    static displayName = 'Scheduler';
    static icon = 'update';
    static color = '#66BB6A'; // Light green - recurring trigger

    static propertySchema = [
        { key: 'interval', type: 'number', label: 'Interval (seconds)', defaultValue: 5, min: 0.1, step: 0.1 },
        { key: 'repeats', type: 'number', label: 'Repeats (-1 = infinite)', defaultValue: -1, min: -1, step: 1 }
    ];
    static inputPorts = [];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.runCount = 0;
    }

    getHeight() {
        return this.collapsed ? 56 : 100;
    }

    createInitialMessage() {
        this.runCount++;
        return new Message(this.id, {
            _schedulerRun: this.runCount,
            _scheduledAt: Date.now()
        });
    }

    enrich(message) {
        // Scheduler doesn't receive messages, it creates them
        return {
            message: this.createInitialMessage().withPath(this.id),
            outputPort: 'output',
            delay: 0
        };
    }

    shouldContinue() {
        const repeats = this.properties.repeats;
        if (repeats === -1) return true;
        return this.runCount <= repeats;
    }

    resetRunState() {
        super.resetRunState();
        this.runCount = 0;
    }

    getPreviewText() {
        const interval = this.properties.interval || 5;
        const repeats = this.properties.repeats ?? -1;

        let text = `${interval}s`;

        if (repeats === -1) {
            text += ' ∞';
        } else {
            text += ` (${this.runCount}/${repeats})`;
        }

        return text;
    }
}

NodeRegistry.register(SchedulerNode);
