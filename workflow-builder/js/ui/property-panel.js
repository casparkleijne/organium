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
            const propsSection = this._createCollapsibleSection('Properties');
            const propsContent = propsSection.querySelector('.property-section-content');

            schema.forEach(prop => {
                const field = this._createPropertyField(node, prop);
                propsContent.appendChild(field);
            });

            this.container.appendChild(propsSection);
        }

        // Connections section
        const connectionsSection = this._renderConnections(node);
        this.container.appendChild(connectionsSection);

        // JSON section
        const jsonSection = this._renderJsonView(node);
        this.container.appendChild(jsonSection);

        // Actions section
        const actionsSection = this._createCollapsibleSection('Actions');
        const actionsContent = actionsSection.querySelector('.property-section-content');

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
        actionsContent.appendChild(actions);

        this.container.appendChild(actionsSection);
    }

    _createCollapsibleSection(title) {
        const section = document.createElement('div');
        section.className = 'property-section';

        const header = document.createElement('div');
        header.className = 'property-section-header';

        const headerText = document.createElement('span');
        headerText.textContent = title;
        header.appendChild(headerText);

        const collapseIcon = document.createElement('span');
        collapseIcon.className = 'material-symbols-outlined collapse-icon';
        collapseIcon.textContent = 'expand_more';
        header.appendChild(collapseIcon);

        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });

        section.appendChild(header);

        const content = document.createElement('div');
        content.className = 'property-section-content';
        section.appendChild(content);

        return section;
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
                    let value = input.value;
                    // Check if this is a variable name property that needs uniqueness
                    const isVariableNameProp =
                        (node.getType() === 'constant' && prop.key === 'name') ||
                        (node.getType() === 'calculate' && prop.key === 'outputKey');

                    if (isVariableNameProp && value) {
                        // Generate unique name if there's a conflict
                        value = this.store.generateUniqueVariableName(value, node.id);
                        if (value !== input.value) {
                            input.value = value; // Update input to show the unique name
                        }
                    }
                    node.setProperty(prop.key, value);
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

            case 'variable-select':
                input = document.createElement('select');
                input.className = 'variable-select';

                // Get upstream variables
                const upstreamVars = this.store.getUpstreamVariables(node.id);
                const currentValue = node.properties[prop.key] || '';

                // Add empty option
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '-- Select variable --';
                emptyOpt.selected = !currentValue;
                input.appendChild(emptyOpt);

                // Add upstream variables
                upstreamVars.forEach(varName => {
                    const option = document.createElement('option');
                    option.value = varName;
                    option.textContent = varName;
                    option.selected = currentValue === varName;
                    input.appendChild(option);
                });

                // If current value is not in the list, add it as custom
                if (currentValue && !upstreamVars.includes(currentValue)) {
                    const customOpt = document.createElement('option');
                    customOpt.value = currentValue;
                    customOpt.textContent = `${currentValue} (custom)`;
                    customOpt.selected = true;
                    input.appendChild(customOpt);
                }

                // Add divider and custom option
                const dividerOpt = document.createElement('option');
                dividerOpt.disabled = true;
                dividerOpt.textContent = '────────────';
                input.appendChild(dividerOpt);

                const customOption = document.createElement('option');
                customOption.value = '__custom__';
                customOption.textContent = '+ Custom value...';
                input.appendChild(customOption);

                input.addEventListener('change', () => {
                    if (input.value === '__custom__') {
                        // Prompt for custom value
                        const custom = prompt('Enter custom variable name:', currentValue);
                        if (custom !== null && custom.trim()) {
                            node.setProperty(prop.key, custom.trim());
                            this.renderer.requestRender();
                            this.render();
                        } else {
                            // Reset to previous value
                            input.value = currentValue;
                        }
                    } else {
                        node.setProperty(prop.key, input.value);
                        this.renderer.requestRender();
                    }
                });

                // Show indicator if no upstream vars
                if (upstreamVars.length === 0) {
                    const hint = document.createElement('span');
                    hint.className = 'variable-hint';
                    hint.textContent = 'No upstream variables found';
                    field.appendChild(label);
                    field.appendChild(input);
                    field.appendChild(hint);
                    input.className = 'property-input variable-select';
                    return field;
                }
                break;

            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = node.properties[prop.key] || '';
        }

        if (input) {
            // Preserve existing classes like 'variable-select'
            if (!input.className.includes('variable-select')) {
                input.className = 'property-input';
            } else {
                input.className = 'property-input variable-select';
            }
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
        const section = this._createCollapsibleSection('Connections');
        const content = section.querySelector('.property-section-content');

        const incoming = this.store.getConnectionsToNode(node.id);
        const outgoing = this.store.getConnectionsFromNode(node.id);

        if (incoming.length === 0 && outgoing.length === 0) {
            const noConns = document.createElement('div');
            noConns.className = 'property-no-connections';
            noConns.textContent = 'No connections';
            content.appendChild(noConns);
            return section;
        }

        if (incoming.length > 0) {
            const inLabel = document.createElement('div');
            inLabel.className = 'connection-group-label';
            inLabel.textContent = 'Incoming';
            content.appendChild(inLabel);

            incoming.forEach(conn => {
                const item = this._createConnectionItem(conn, true);
                content.appendChild(item);
            });
        }

        if (outgoing.length > 0) {
            const outLabel = document.createElement('div');
            outLabel.className = 'connection-group-label';
            outLabel.textContent = 'Outgoing';
            content.appendChild(outLabel);

            outgoing.forEach(conn => {
                const item = this._createConnectionItem(conn, false);
                content.appendChild(item);
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

    _renderJsonView(node) {
        const section = this._createCollapsibleSection('JSON');
        section.classList.add('collapsed'); // Start collapsed
        const content = section.querySelector('.property-section-content');

        const jsonData = node.serialize();
        const formatted = JSON.stringify(jsonData, null, 2);

        const pre = document.createElement('pre');
        pre.className = 'json-view';
        pre.textContent = formatted;

        content.appendChild(pre);
        return section;
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
