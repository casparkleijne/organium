/**
 * Store - central state management
 */
import { EventEmitter } from '../utils/event-emitter.js';
import { NodeRegistry } from '../core/registry.js';
import { Connection } from '../core/connection.js';

export class Store extends EventEmitter {
    constructor() {
        super();

        this.nodes = new Map();
        this.connections = new Map();

        this.selection = {
            nodeIds: new Set(),
            focusMode: false
        };

        this.viewport = {
            panX: 100,
            panY: 100,
            zoom: 1
        };

        this.settings = {
            showGrid: true,
            snapToGrid: true,
            gridSize: 20,
            executionSpeed: 1
        };

        this.execution = {
            status: 'idle',
            activeMessages: new Map(),
            messagePositions: new Map()
        };

        this._loadSettings();
    }

    // Node operations
    addNode(type, x, y) {
        const node = NodeRegistry.create(type, x, y);
        this.nodes.set(node.id, node);

        // Ensure unique variable names for nodes that output variables
        this._ensureUniqueVariableNames(node);

        this.emit('nodeAdded', node);
        this.emit('change');
        return node;
    }

    /**
     * Ensure a node's output variable names are unique
     */
    _ensureUniqueVariableNames(node) {
        const type = node.getType();
        if (type === 'constant' && node.properties.name) {
            node.properties.name = this.generateUniqueVariableName(
                node.properties.name,
                node.id
            );
        } else if (type === 'calculate' && node.properties.outputKey) {
            node.properties.outputKey = this.generateUniqueVariableName(
                node.properties.outputKey,
                node.id
            );
        }
    }

    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Remove all connections involving this node
        const connectionsToRemove = [];
        this.connections.forEach((conn, id) => {
            if (conn.involvesNode(nodeId)) {
                connectionsToRemove.push(id);
            }
        });
        connectionsToRemove.forEach(id => this.connections.delete(id));

        this.nodes.delete(nodeId);
        this.selection.nodeIds.delete(nodeId);

        console.log('Node deleted:', nodeId, node.getType());
        this.emit('nodeRemoved', node);
        this.emit('change');
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    getNodes() {
        return this.nodes;
    }

    // Connection operations
    addConnection(fromNodeId, fromPortId, toNodeId, toPortId) {
        // Check if connection already exists
        for (const conn of this.connections.values()) {
            if (conn.fromNodeId === fromNodeId && conn.fromPortId === fromPortId &&
                conn.toNodeId === toNodeId && conn.toPortId === toPortId) {
                return null;
            }
        }

        const connection = new Connection(fromNodeId, fromPortId, toNodeId, toPortId);
        this.connections.set(connection.id, connection);
        this.emit('connectionAdded', connection);
        this.emit('change');
        return connection;
    }

    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        this.connections.delete(connectionId);
        this.emit('connectionRemoved', connection);
        this.emit('change');
    }

    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }

    getConnections() {
        return this.connections;
    }

    getConnectionsFromNode(nodeId) {
        const result = [];
        this.connections.forEach(conn => {
            if (conn.fromNodeId === nodeId) result.push(conn);
        });
        return result;
    }

    getConnectionsToNode(nodeId) {
        const result = [];
        this.connections.forEach(conn => {
            if (conn.toNodeId === nodeId) result.push(conn);
        });
        return result;
    }

    /**
     * Get all upstream nodes (nodes that feed into this node)
     */
    getUpstreamNodes(nodeId) {
        const upstream = new Set();
        const queue = [nodeId];
        const visited = new Set();

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const incomingConns = this.getConnectionsToNode(currentId);
            for (const conn of incomingConns) {
                if (!upstream.has(conn.fromNodeId)) {
                    upstream.add(conn.fromNodeId);
                    queue.push(conn.fromNodeId);
                }
            }
        }

        return Array.from(upstream).map(id => this.nodes.get(id)).filter(Boolean);
    }

    /**
     * Get all variable names available at a node (from upstream nodes)
     */
    getUpstreamVariables(nodeId) {
        const variables = [];
        const upstreamNodes = this.getUpstreamNodes(nodeId);

        for (const node of upstreamNodes) {
            const outputVars = this._getNodeOutputVariables(node);
            variables.push(...outputVars);
        }

        // Return unique variable names
        return [...new Set(variables)];
    }

    /**
     * Get variable names that a node outputs
     */
    _getNodeOutputVariables(node) {
        const type = node.getType();
        const vars = [];

        switch (type) {
            case 'constant':
                vars.push(node.properties.name || 'value');
                break;
            case 'calculate':
                vars.push(node.properties.outputKey || 'result');
                break;
            case 'start':
                // Start node can have initial payload keys
                if (node.properties.payload) {
                    try {
                        const payload = JSON.parse(node.properties.payload);
                        vars.push(...Object.keys(payload));
                    } catch (e) { /* ignore parse errors */ }
                }
                break;
            default:
                // Check if node has a getOutputVariables method
                if (typeof node.getOutputVariables === 'function') {
                    vars.push(...node.getOutputVariables());
                }
        }

        return vars;
    }

    /**
     * Get all variable names defined in the workflow
     */
    getAllVariableNames() {
        const variables = new Map(); // name -> nodeId
        for (const [nodeId, node] of this.nodes) {
            const outputVars = this._getNodeOutputVariables(node);
            for (const varName of outputVars) {
                if (!variables.has(varName)) {
                    variables.set(varName, nodeId);
                }
            }
        }
        return variables;
    }

    /**
     * Check if a variable name is already used by another node
     */
    isVariableNameUsed(name, excludeNodeId = null) {
        for (const [nodeId, node] of this.nodes) {
            if (nodeId === excludeNodeId) continue;
            const outputVars = this._getNodeOutputVariables(node);
            if (outputVars.includes(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate a unique variable name by appending a number suffix
     */
    generateUniqueVariableName(baseName, excludeNodeId = null) {
        let name = baseName;
        let counter = 1;
        while (this.isVariableNameUsed(name, excludeNodeId)) {
            name = `${baseName}${counter}`;
            counter++;
        }
        return name;
    }

    // Selection operations
    selectNode(nodeId, addToSelection = false) {
        if (!addToSelection) {
            this.selection.nodeIds.forEach(id => {
                const node = this.nodes.get(id);
                if (node) node.setSelected(false);
            });
            this.selection.nodeIds.clear();
        }

        const node = this.nodes.get(nodeId);
        if (node) {
            node.setSelected(true);
            this.selection.nodeIds.add(nodeId);
        }

        this.emit('selectionChanged', this.getSelectedNodes());
        this.emit('change');
    }

    deselectNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.setSelected(false);
        }
        this.selection.nodeIds.delete(nodeId);
        this.emit('selectionChanged', this.getSelectedNodes());
        this.emit('change');
    }

    clearSelection() {
        this.selection.nodeIds.forEach(id => {
            const node = this.nodes.get(id);
            if (node) node.setSelected(false);
        });
        this.selection.nodeIds.clear();
        this.emit('selectionChanged', []);
        this.emit('change');
    }

    selectAll() {
        this.nodes.forEach(node => {
            node.setSelected(true);
            this.selection.nodeIds.add(node.id);
        });
        this.emit('selectionChanged', this.getSelectedNodes());
        this.emit('change');
    }

    getSelectedNodes() {
        const nodes = [];
        this.selection.nodeIds.forEach(id => {
            const node = this.nodes.get(id);
            if (node) nodes.push(node);
        });
        return nodes;
    }

    toggleFocusMode() {
        this.selection.focusMode = !this.selection.focusMode;
        this.emit('change');
    }

    // Viewport operations
    setViewport(panX, panY, zoom) {
        this.viewport.panX = panX;
        this.viewport.panY = panY;
        this.viewport.zoom = zoom;
        this.emit('viewportChanged', this.viewport);
        this.emit('change');
    }

    getViewport() {
        return { ...this.viewport };
    }

    // Settings operations
    setSetting(key, value) {
        this.settings[key] = value;
        this._saveSettings();
        this.emit('settingsChanged', this.settings);
        this.emit('change');
    }

    getSettings() {
        return { ...this.settings };
    }

    _loadSettings() {
        try {
            const saved = localStorage.getItem('workflowBuilder_settings');
            if (saved) {
                Object.assign(this.settings, JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    _saveSettings() {
        try {
            localStorage.setItem('workflowBuilder_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    // Execution state
    setExecutionStatus(status) {
        this.execution.status = status;
        this.emit('executionChanged', this.execution);
        this.emit('change');
    }

    getExecutionState() {
        return { ...this.execution };
    }

    // Serialization
    serialize() {
        return {
            version: '1.0',
            metadata: {
                name: 'Workflow',
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            },
            nodes: Array.from(this.nodes.values()).map(node => node.serialize()),
            connections: Array.from(this.connections.values()).map(conn => conn.serialize()),
            viewport: { ...this.viewport },
            settings: { ...this.settings }
        };
    }

    deserialize(data) {
        // Clear current state
        this.nodes.clear();
        this.connections.clear();
        this.selection.nodeIds.clear();

        // Restore nodes
        if (data.nodes) {
            data.nodes.forEach(nodeData => {
                try {
                    const node = NodeRegistry.deserialize(nodeData);
                    this.nodes.set(node.id, node);
                } catch (e) {
                    console.error('Failed to deserialize node:', e);
                }
            });
        }

        // Restore connections
        if (data.connections) {
            data.connections.forEach(connData => {
                try {
                    const conn = Connection.deserialize(connData);
                    this.connections.set(conn.id, conn);
                } catch (e) {
                    console.error('Failed to deserialize connection:', e);
                }
            });
        }

        // Restore viewport
        if (data.viewport) {
            this.viewport = { ...data.viewport };
        }

        // Restore settings
        if (data.settings) {
            Object.assign(this.settings, data.settings);
        }

        this.emit('loaded');
        this.emit('change');
    }

    clear() {
        this.nodes.clear();
        this.connections.clear();
        this.selection.nodeIds.clear();
        this.emit('cleared');
        this.emit('change');
    }

    // Get state for renderer
    getState() {
        return {
            nodes: this.nodes,
            connections: this.connections,
            executionState: this.execution
        };
    }
}
