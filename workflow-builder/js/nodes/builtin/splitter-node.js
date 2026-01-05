/**
 * SplitterNode - duplicates message to multiple branches or picks random
 */
import { BaseNode } from '../../core/base-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class SplitterNode extends BaseNode {
    static type = 'splitter';
    static category = 'Logic';
    static displayName = 'Splitter';
    static icon = 'share';
    static color = '#FFCA28'; // Amber - splitting

    static propertySchema = [
        { key: 'mode', type: 'select', label: 'Mode', defaultValue: 'all', options: [
            { value: 'all', label: 'All branches' },
            { value: 'random', label: 'Random branch' }
        ]}
    ];
    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    constructor(x, y, id) {
        super(x, y, id);
        this.branchCount = 0;
        this.selectedBranch = null;
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    // Splitter is special - the executor handles the actual splitting
    // This returns the base enriched message, executor creates forks
    enrich(message) {
        const mode = this.properties.mode || 'all';
        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0,
            split: true,
            splitMode: mode
        };
    }

    setBranchCount(count) {
        this.branchCount = count;
    }

    setSelectedBranch(index) {
        this.selectedBranch = index;
    }

    getPreviewText() {
        const mode = this.properties.mode || 'all';
        if (mode === 'random') {
            if (this.selectedBranch !== null) {
                return `Rnd #${this.selectedBranch + 1}`;
            }
            return 'Random';
        }
        if (this.branchCount > 0) {
            return `${this.branchCount}x`;
        }
        return 'All';
    }

    resetRunState() {
        super.resetRunState();
        this.branchCount = 0;
        this.selectedBranch = null;
    }
}

NodeRegistry.register(SplitterNode);
