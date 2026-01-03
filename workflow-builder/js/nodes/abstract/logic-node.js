/**
 * LogicNode - abstract base for decision/merge nodes
 */
import { BaseNode } from '../../core/base-node.js';

export class LogicNode extends BaseNode {
    static category = 'Logic';

    constructor(x, y, id) {
        super(x, y, id);
        this.waitingMessages = new Map();
    }

    resetRunState() {
        super.resetRunState();
        this.waitingMessages.clear();
    }
}
