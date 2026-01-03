/**
 * SplitterNode - duplicates message to multiple branches
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class SplitterNode extends BaseNode {
    static type = 'splitter';
    static category = 'Logic';
    static displayName = 'Splitter';
    static icon = 'share';
    static color = '#FFCA28'; // Amber - splitting

    static propertySchema = [];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.branchCount = 0;
    }

    getHeight() {
        return this.collapsed ? 56 : 70;
    }

    // Splitter is special - the executor handles the actual splitting
    // This returns the base enriched message, executor creates forks
    enrich(message) {
        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0,
            split: true // Signal to executor to fork the message
        };
    }

    setBranchCount(count) {
        this.branchCount = count;
    }

    getPreviewText() {
        if (this.branchCount > 0) {
            return `→ ${this.branchCount} branches`;
        }
        return 'Split flow';
    }

    resetRunState() {
        super.resetRunState();
        this.branchCount = 0;
    }
}

NodeRegistry.register(SplitterNode);
