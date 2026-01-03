/**
 * Port definition for node inputs/outputs
 */

export class PortDefinition {
    constructor(id, options = {}) {
        this.id = id;
        this.label = options.label || null;
        this.position = options.position || 'bottom'; // 'top', 'bottom', 'left', 'right'
    }
}

export class Port {
    constructor(nodeId, definition, isInput) {
        this.nodeId = nodeId;
        this.id = definition.id;
        this.label = definition.label;
        this.position = definition.position;
        this.isInput = isInput;
    }

    getFullId() {
        return `${this.nodeId}:${this.id}`;
    }
}
