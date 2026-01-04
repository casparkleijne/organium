/**
 * Connection between two ports
 */
import { createGUID } from '../utils/guid.js';

export class Connection {
    constructor(fromNodeId, fromPortId, toNodeId, toPortId, id = null) {
        this.id = id || createGUID();
        this.fromNodeId = fromNodeId;
        this.fromPortId = fromPortId;
        this.toNodeId = toNodeId;
        this.toPortId = toPortId;

        // Execution state: 'idle' | 'active' | 'completed'
        this.runState = 'idle';
        // Message dot animation progress (0-1)
        this.messageProgress = 0;
    }

    setRunState(state) {
        this.runState = state;
        if (state === 'active') {
            this.messageProgress = 0;
        }
    }

    resetRunState() {
        this.runState = 'idle';
        this.messageProgress = 0;
    }

    serialize() {
        return {
            id: this.id,
            from: this.fromNodeId,
            fromPort: this.fromPortId,
            to: this.toNodeId,
            toPort: this.toPortId
        };
    }

    static deserialize(data) {
        return new Connection(
            data.from,
            data.fromPort,
            data.to,
            data.toPort,
            data.id
        );
    }

    equals(other) {
        return this.fromNodeId === other.fromNodeId &&
               this.fromPortId === other.fromPortId &&
               this.toNodeId === other.toNodeId &&
               this.toPortId === other.toPortId;
    }

    involvesNode(nodeId) {
        return this.fromNodeId === nodeId || this.toNodeId === nodeId;
    }
}
