/**
 * Validator - validates workflow before execution
 */

export class Validator {
    constructor(store) {
        this.store = store;
    }

    validate() {
        const errors = [];
        const nodes = this.store.getNodes();
        const connections = this.store.getConnections();

        // Check for start/scheduler node
        const startNodes = [];
        nodes.forEach(node => {
            if (node.getType() === 'start' || node.getType() === 'scheduler') {
                startNodes.push(node);
            }
        });

        if (startNodes.length === 0) {
            errors.push({
                type: 'error',
                message: 'Workflow must have a Start or Scheduler node',
                nodeId: null
            });
        }

        // Check each node
        nodes.forEach(node => {
            const nodeErrors = this._validateNode(node, connections);
            errors.push(...nodeErrors);
        });

        // Check for cycles (optional, workflows might allow them)
        // const cycleError = this._checkForCycles(nodes, connections);
        // if (cycleError) errors.push(cycleError);

        return {
            valid: errors.filter(e => e.type === 'error').length === 0,
            errors: errors
        };
    }

    _validateNode(node, connections) {
        const errors = [];
        const type = node.getType();
        const title = node.getDisplayTitle();

        // Get connections to/from this node
        const incoming = [];
        const outgoing = [];
        connections.forEach(conn => {
            if (conn.toNodeId === node.id) incoming.push(conn);
            if (conn.fromNodeId === node.id) outgoing.push(conn);
        });

        // Nodes that don't need inputs
        const noInputRequired = ['start', 'scheduler', 'constant'];

        // Check input ports
        const inputPorts = node.getInputPorts();
        if (inputPorts.length > 0 && !noInputRequired.includes(type)) {
            inputPorts.forEach(port => {
                const hasConnection = incoming.some(c => c.toPortId === port.id);
                if (!hasConnection) {
                    // For gate, both inputs are required
                    if (type === 'gate') {
                        errors.push({
                            type: 'error',
                            message: `Gate '${title}' requires both Trigger and Data inputs`,
                            nodeId: node.id
                        });
                    } else if (type === 'awaitall') {
                        // AwaitAll needs at least one input
                        if (incoming.length === 0) {
                            errors.push({
                                type: 'warning',
                                message: `Await All '${title}' has no incoming connections`,
                                nodeId: node.id
                            });
                        }
                    } else if (type !== 'constant') {
                        errors.push({
                            type: 'warning',
                            message: `Node '${title}' has unconnected input`,
                            nodeId: node.id
                        });
                    }
                }
            });
        }

        // Check output ports (except end nodes)
        const outputPorts = node.getOutputPorts();
        if (outputPorts.length > 0) {
            // Decision nodes need both outputs connected
            if (type === 'decision') {
                const hasYes = outgoing.some(c => c.fromPortId === 'yes');
                const hasNo = outgoing.some(c => c.fromPortId === 'no');
                if (!hasYes || !hasNo) {
                    errors.push({
                        type: 'warning',
                        message: `Decision '${title}' should have both Yes and No outputs connected`,
                        nodeId: node.id
                    });
                }
            } else if (outgoing.length === 0 && type !== 'end') {
                errors.push({
                    type: 'warning',
                    message: `Node '${title}' has no outgoing connections`,
                    nodeId: node.id
                });
            }
        }

        return errors;
    }

    _checkForCycles(nodes, connections) {
        // Simple cycle detection using DFS
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            for (const conn of connections.values()) {
                if (conn.fromNodeId === nodeId) {
                    if (!visited.has(conn.toNodeId)) {
                        if (hasCycle(conn.toNodeId)) return true;
                    } else if (recursionStack.has(conn.toNodeId)) {
                        return true;
                    }
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const node of nodes.values()) {
            if (!visited.has(node.id)) {
                if (hasCycle(node.id)) {
                    return {
                        type: 'warning',
                        message: 'Workflow contains cycles (this may cause infinite loops)',
                        nodeId: null
                    };
                }
            }
        }

        return null;
    }
}
