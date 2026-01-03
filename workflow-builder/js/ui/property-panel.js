/**
 * PropertyPanel - right sidebar for node properties
 */

export class PropertyPanel {
    constructor(container, store, renderer) {
        this.container = container;
        this.store = store;
        this.renderer = renderer;

        this.currentNode = null;

        this._bindStoreEvents();
        this.render();
    }

    _bindStoreEvents() {
        this.store.on('selectionChanged', (nodes) => {
            if (nodes.length === 1) {
                this.currentNode = nodes[0];
            } else {
                this.currentNode = null;
            }
            this.render();
        });

        this.store.on('change', () => {
            if (this.currentNode) {
                // Refresh if the current node still exists
                const node = this.store.getNode(this.currentNode.id);
                if (!node) {
                    this.currentNode = null;
                    this.render();
                }
            }
        });
    }

    render() {
        this.container.innerHTML = '';

        if (!this.currentNode) {
            this._renderEmptyState();
            return;
        }

        this._renderNodeProperties();
    }

    _renderEmptyState() {
        const empty = document.createElement('div');
        empty.className = 'property-empty';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = 'touch_app';

        const text = document.createElement('p');
        text.textContent = 'Select a node to edit properties';

        empty.appendChild(icon);
        empty.appendChild(text);
        this.container.appendChild(empty);
    }

    _renderNodeProperties() {
        const node = this.currentNode;

        // Header
        const header = document.createElement('div');
        header.className = 'property-header';

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'property-header-icon';
        iconWrapper.style.backgroundColor = node.getColor();

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = node.getIcon();
        iconWrapper.appendChild(icon);

        const title = document.createElement('input');
        title.className = 'property-title';
        title.type = 'text';
        title.value = node.getDisplayTitle();
        title.placeholder = node.constructor.displayName;
        title.addEventListener('change', () => {
            node.customTitle = title.value || null;
            this.renderer.requestRender();
        });

        header.appendChild(iconWrapper);
        header.appendChild(title);
        this.container.appendChild(header);

        // Node type info
        const typeInfo = document.createElement('div');
        typeInfo.className = 'property-type-info';
        typeInfo.textContent = `Type: ${node.constructor.displayName}`;
        this.container.appendChild(typeInfo);

        // Properties section
        const schema = node.constructor.propertySchema;
        if (schema.length > 0) {
            const propsSection = document.createElement('div');
            propsSection.className = 'property-section';

            const propsHeader = document.createElement('div');
            propsHeader.className = 'property-section-header';
            propsHeader.textContent = 'Properties';
            propsSection.appendChild(propsHeader);

            schema.forEach(prop => {
                const field = this._createPropertyField(node, prop);
                propsSection.appendChild(field);
            });

            this.container.appendChild(propsSection);
        }

        // Connections section
        const connectionsSection = this._renderConnections(node);
        this.container.appendChild(connectionsSection);

        // Actions section
        const actionsSection = document.createElement('div');
        actionsSection.className = 'property-section';

        const actionsHeader = document.createElement('div');
        actionsHeader.className = 'property-section-header';
        actionsHeader.textContent = 'Actions';
        actionsSection.appendChild(actionsHeader);

        const actions = document.createElement('div');
        actions.className = 'property-actions';

        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'btn btn-outlined';
        duplicateBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>Duplicate';
        duplicateBtn.addEventListener('click', () => this._duplicateNode(node));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outlined btn-danger';
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>Delete';
        deleteBtn.addEventListener('click', () => this._deleteNode(node));

        actions.appendChild(duplicateBtn);
        actions.appendChild(deleteBtn);
        actionsSection.appendChild(actions);

        this.container.appendChild(actionsSection);
    }

    _createPropertyField(node, prop) {
        const field = document.createElement('div');
        field.className = 'property-field';

        const label = document.createElement('label');
        label.textContent = prop.label;
        field.appendChild(label);

        let input;

        switch (prop.type) {
            case 'string':
                input = document.createElement('input');
                input.type = 'text';
                input.value = node.properties[prop.key] || '';
                input.placeholder = prop.placeholder || '';
                input.addEventListener('change', () => {
                    node.setProperty(prop.key, input.value);
                    this.renderer.requestRender();
                });
                break;

            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = node.properties[prop.key] ?? prop.defaultValue ?? 0;
                if (prop.min !== undefined) input.min = prop.min;
                if (prop.max !== undefined) input.max = prop.max;
                if (prop.step !== undefined) input.step = prop.step;
                input.addEventListener('change', () => {
                    node.setProperty(prop.key, parseFloat(input.value));
                    this.renderer.requestRender();
                });
                break;

            case 'boolean':
                const toggle = document.createElement('div');
                toggle.className = 'toggle-wrapper';

                input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `prop-${prop.key}`;
                input.checked = !!node.properties[prop.key];

                const slider = document.createElement('span');
                slider.className = 'toggle-slider';

                input.addEventListener('change', () => {
                    node.setProperty(prop.key, input.checked);
                    this.renderer.requestRender();
                    this.render(); // Re-render to show/hide conditional fields
                });

                toggle.appendChild(input);
                toggle.appendChild(slider);
                field.appendChild(toggle);
                return field;

            case 'select':
                input = document.createElement('select');
                prop.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    option.selected = node.properties[prop.key] === opt.value;
                    input.appendChild(option);
                });
                input.addEventListener('change', () => {
                    node.setProperty(prop.key, input.value);
                    this.renderer.requestRender();
                    this.render(); // Re-render for conditional fields
                });
                break;

            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = node.properties[prop.key] || '';
        }

        if (input) {
            input.className = 'property-input';
            field.appendChild(input);
        }

        // Conditional visibility
        if (this._shouldHideField(node, prop)) {
            field.style.display = 'none';
        }

        return field;
    }

    _shouldHideField(node, prop) {
        // Hide certain fields based on other property values
        if (node.getType() === 'constant') {
            if (prop.key === 'useRandom' || prop.key === 'min' || prop.key === 'max') {
                if (node.properties.dataType !== 'number') return true;
            }
            if ((prop.key === 'min' || prop.key === 'max') && !node.properties.useRandom) {
                return true;
            }
        }

        if (node.getType() === 'decision') {
            if (prop.key === 'expression' && node.properties.mode !== 'expression') return true;
            if (['keyA', 'comparator', 'keyB'].includes(prop.key) && node.properties.mode === 'expression') return true;
        }

        return false;
    }

    _renderConnections(node) {
        const section = document.createElement('div');
        section.className = 'property-section';

        const header = document.createElement('div');
        header.className = 'property-section-header';
        header.textContent = 'Connections';
        section.appendChild(header);

        const incoming = this.store.getConnectionsToNode(node.id);
        const outgoing = this.store.getConnectionsFromNode(node.id);

        if (incoming.length === 0 && outgoing.length === 0) {
            const noConns = document.createElement('div');
            noConns.className = 'property-no-connections';
            noConns.textContent = 'No connections';
            section.appendChild(noConns);
            return section;
        }

        if (incoming.length > 0) {
            const inLabel = document.createElement('div');
            inLabel.className = 'connection-group-label';
            inLabel.textContent = 'Incoming';
            section.appendChild(inLabel);

            incoming.forEach(conn => {
                const item = this._createConnectionItem(conn, true);
                section.appendChild(item);
            });
        }

        if (outgoing.length > 0) {
            const outLabel = document.createElement('div');
            outLabel.className = 'connection-group-label';
            outLabel.textContent = 'Outgoing';
            section.appendChild(outLabel);

            outgoing.forEach(conn => {
                const item = this._createConnectionItem(conn, false);
                section.appendChild(item);
            });
        }

        return section;
    }

    _createConnectionItem(conn, isIncoming) {
        const item = document.createElement('div');
        item.className = 'connection-item';

        const otherNodeId = isIncoming ? conn.fromNodeId : conn.toNodeId;
        const otherNode = this.store.getNode(otherNodeId);
        const portId = isIncoming ? conn.fromPortId : conn.toPortId;

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = isIncoming ? 'arrow_back' : 'arrow_forward';

        const text = document.createElement('span');
        text.className = 'connection-text';
        text.textContent = otherNode ? `${otherNode.getDisplayTitle()} (${portId})` : 'Unknown';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'connection-delete';
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
        deleteBtn.addEventListener('click', () => {
            this.store.removeConnection(conn.id);
            this.render();
        });

        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(deleteBtn);

        return item;
    }

    _duplicateNode(node) {
        const newNode = node.clone(node.x + 50, node.y + 50);
        this.store.nodes.set(newNode.id, newNode);
        this.store.clearSelection();
        this.store.selectNode(newNode.id, true);
        this.store.emit('change');
    }

    _deleteNode(node) {
        this.store.removeNode(node.id);
    }
}
