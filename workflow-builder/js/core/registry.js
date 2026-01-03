/**
 * NodeRegistry - central registration point for all node types
 */

class NodeRegistryClass {
    constructor() {
        this._types = new Map();
        this._categories = new Map();
    }

    register(nodeClass) {
        const type = nodeClass.type;
        if (this._types.has(type)) {
            console.warn(`Node type "${type}" already registered, overwriting`);
        }
        this._types.set(type, nodeClass);

        // Update category index
        const category = nodeClass.category;
        if (!this._categories.has(category)) {
            this._categories.set(category, []);
        }
        const categoryList = this._categories.get(category);
        if (!categoryList.includes(nodeClass)) {
            categoryList.push(nodeClass);
        }
    }

    unregister(type) {
        const nodeClass = this._types.get(type);
        if (nodeClass) {
            this._types.delete(type);
            const category = nodeClass.category;
            if (this._categories.has(category)) {
                const list = this._categories.get(category);
                const index = list.indexOf(nodeClass);
                if (index > -1) {
                    list.splice(index, 1);
                }
            }
        }
    }

    getType(typeName) {
        return this._types.get(typeName);
    }

    getAllTypes() {
        return Array.from(this._types.values());
    }

    getByCategory(category) {
        return this._categories.get(category) || [];
    }

    getAllCategories() {
        return Array.from(this._categories.keys());
    }

    getCategoriesWithNodes() {
        const result = [];
        this._categories.forEach((nodes, category) => {
            result.push({
                name: category,
                nodes: nodes
            });
        });
        return result;
    }

    create(typeName, x, y) {
        const NodeClass = this._types.get(typeName);
        if (!NodeClass) {
            throw new Error(`Unknown node type: ${typeName}`);
        }
        return new NodeClass(x, y);
    }

    deserialize(data) {
        const NodeClass = this._types.get(data.type);
        if (!NodeClass) {
            throw new Error(`Unknown node type: ${data.type}`);
        }
        const node = new NodeClass(data.position.x, data.position.y, data.id);
        node.collapsed = data.collapsed || false;
        node.customTitle = data.customTitle || null;
        if (data.properties) {
            Object.keys(data.properties).forEach(key => {
                node.properties[key] = data.properties[key];
            });
        }
        return node;
    }

    hasType(typeName) {
        return this._types.has(typeName);
    }
}

// Singleton export
export const NodeRegistry = new NodeRegistryClass();
