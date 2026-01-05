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

        // Count start, scheduler, and end nodes
        let startCount = 0;
        let schedulerCount = 0;
        let endCount = 0;

        nodes.forEach(node => {
            const type = node.getType();
            if (type === 'start') startCount++;
            if (type === 'scheduler') schedulerCount++;
            if (type === 'end') endCount++;
        });

        // Must have exactly 1 start OR 1 scheduler (not both, not zero)
        const entryCount = startCount + schedulerCount;
        if (entryCount === 0) {
            errors.push({
                type: 'error',
                message: 'Workflow must have exactly 1 Start or Scheduler node',
                nodeId: null
            });
        } else if (entryCount > 1) {
            errors.push({
                type: 'error',
                message: `Workflow must have exactly 1 Start or Scheduler node (found ${startCount} Start, ${schedulerCount} Scheduler)`,
                nodeId: null
            });
        }

        // Must have exactly 1 end node
        if (endCount === 0) {
            errors.push({
                type: 'error',
                message: 'Workflow must have exactly 1 End node',
                nodeId: null
            });
        } else if (endCount > 1) {
            errors.push({
                type: 'error',
                message: `Workflow must have exactly 1 End node (found ${endCount})`,
                nodeId: null
            });
        }

        // Check each node for required connections
        nodes.forEach(node => {
            const nodeErrors = this._validateNode(node, connections);
            errors.push(...nodeErrors);
        });

        // Check for shared ports (only splitter output and await-all input allowed)
        const sharedPortErrors = this._validateSharedPorts(nodes, connections);
        errors.push(...sharedPortErrors);

        // Check timer/delay intervals
        const timerErrors = this._validateTimerIntervals(nodes, connections);
        errors.push(...timerErrors);

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

        // Check input ports - ALL inputs must be connected
        const inputPorts = node.getInputPorts();
        if (inputPorts.length > 0 && !noInputRequired.includes(type)) {
            inputPorts.forEach(port => {
                const hasConnection = incoming.some(c => c.toPortId === port.id);
                if (!hasConnection) {
                    errors.push({
                        type: 'error',
                        message: `Node '${title}' has unconnected input port '${port.label || port.id}'`,
                        nodeId: node.id
                    });
                }
            });
        }

        // Check output ports - ALL outputs must be connected (except end nodes)
        const outputPorts = node.getOutputPorts();
        if (outputPorts.length > 0 && type !== 'end') {
            outputPorts.forEach(port => {
                const hasConnection = outgoing.some(c => c.fromPortId === port.id);
                if (!hasConnection) {
                    errors.push({
                        type: 'error',
                        message: `Node '${title}' has unconnected output port '${port.label || port.id}'`,
                        nodeId: node.id
                    });
                }
            });
        }

        return errors;
    }

    _validateSharedPorts(nodes, connections) {
        const errors = [];

        // Build maps of connections per port
        const inputPortConnections = new Map(); // "nodeId:portId" -> count
        const outputPortConnections = new Map(); // "nodeId:portId" -> count

        connections.forEach(conn => {
            const inputKey = `${conn.toNodeId}:${conn.toPortId}`;
            const outputKey = `${conn.fromNodeId}:${conn.fromPortId}`;

            inputPortConnections.set(inputKey, (inputPortConnections.get(inputKey) || 0) + 1);
            outputPortConnections.set(outputKey, (outputPortConnections.get(outputKey) || 0) + 1);
        });

        // Check for shared input ports (only await-all allowed)
        inputPortConnections.forEach((count, key) => {
            if (count > 1) {
                const [nodeId, portId] = key.split(':');
                const node = this.store.getNode(nodeId);
                if (node && node.getType() !== 'awaitall') {
                    errors.push({
                        type: 'error',
                        message: `Node '${node.getDisplayTitle()}' input port '${portId}' has multiple connections (${count})`,
                        nodeId: nodeId
                    });
                }
            }
        });

        // Check for shared output ports (only splitter allowed)
        outputPortConnections.forEach((count, key) => {
            if (count > 1) {
                const [nodeId, portId] = key.split(':');
                const node = this.store.getNode(nodeId);
                if (node && node.getType() !== 'splitter') {
                    errors.push({
                        type: 'error',
                        message: `Node '${node.getDisplayTitle()}' output port '${portId}' has multiple connections (${count})`,
                        nodeId: nodeId
                    });
                }
            }
        });

        return errors;
    }

    _validateTimerIntervals(nodes, connections) {
        const errors = [];

        // Build adjacency map for quick lookup
        const outgoingMap = new Map();
        connections.forEach(conn => {
            if (!outgoingMap.has(conn.fromNodeId)) {
                outgoingMap.set(conn.fromNodeId, []);
            }
            outgoingMap.get(conn.fromNodeId).push(conn.toNodeId);
        });

        // Find all scheduler nodes
        const schedulers = [];
        nodes.forEach(node => {
            if (node.getType() === 'scheduler') {
                schedulers.push(node);
            }
        });

        // For each scheduler, calculate max path time
        schedulers.forEach(scheduler => {
            const intervalMs = scheduler.properties.interval || 5000;
            const maxPathTime = this._calculateMaxPathTime(scheduler.id, outgoingMap, new Set());

            if (maxPathTime > intervalMs) {
                errors.push({
                    type: 'warning',
                    message: `Path from '${scheduler.getDisplayTitle()}' takes ${maxPathTime}ms but interval is ${intervalMs}ms - messages may pile up`,
                    nodeId: scheduler.id
                });
            }
        });

        return errors;
    }

    _calculateMaxPathTime(nodeId, outgoingMap, visited) {
        if (visited.has(nodeId)) return 0; // Cycle protection
        visited.add(nodeId);

        const node = this.store.getNode(nodeId);
        if (!node) return 0;

        // Calculate time contribution of this node
        let nodeTime = 0;
        const type = node.getType();

        if (type === 'delay') {
            nodeTime = node.properties.ms || 1000;
        } else if (type === 'repeater') {
            const count = node.properties.count || 3;
            const delay = node.properties.delay || 0;
            // Time = (count - 1) * delay (first one is immediate, then delay between each)
            // Plus minimum 100ms between repeats enforced by executor
            nodeTime = (count - 1) * Math.max(delay, 100);
        }

        // Get max time of all downstream paths
        const children = outgoingMap.get(nodeId) || [];
        let maxChildTime = 0;

        children.forEach(childId => {
            const childTime = this._calculateMaxPathTime(childId, outgoingMap, new Set(visited));
            maxChildTime = Math.max(maxChildTime, childTime);
        });

        return nodeTime + maxChildTime;
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
