/**
 * Abstract BaseNode class - all nodes extend this
 */
import { createGUID } from '../utils/guid.js';
import { PortDefinition } from './port.js';

export class BaseNode {
    // Static metadata - override in subclasses
    static type = 'base';
    static category = 'Base';
    static displayName = 'Base Node';
    static icon = 'help';
    static color = '#888888';

    // Static schema - override in subclasses
    static propertySchema = [];
    static inputPorts = [];
    static outputPorts = [];

    constructor(x, y, id = null) {
        this.id = id || createGUID();
        this.x = x;
        this.y = y;
        this.selected = false;
        this.collapsed = false;
        this.hovered = false;
        this.customTitle = null;
        this.properties = this._initProperties();

        // Execution state
        this.runState = 'idle'; // 'idle' | 'active' | 'completed' | 'waiting' | 'error'
        this.runData = null;
    }

    _initProperties() {
        const props = {};
        this.constructor.propertySchema.forEach(schema => {
            props[schema.key] = schema.defaultValue !== undefined ? schema.defaultValue : null;
        });
        return props;
    }

    // Identity
    getType() {
        return this.constructor.type;
    }

    getDisplayTitle() {
        return this.customTitle || this.constructor.displayName;
    }

    getIcon() {
        return this.constructor.icon;
    }

    getColor() {
        return this.constructor.color;
    }

    getCategory() {
        return this.constructor.category;
    }

    // Ports
    getInputPorts() {
        return this.constructor.inputPorts.map(def =>
            new PortDefinition(def.id, def)
        );
    }

    getOutputPorts() {
        return this.constructor.outputPorts.map(def =>
            new PortDefinition(def.id, def)
        );
    }

    hasInputPort(portId) {
        return this.constructor.inputPorts.some(p => p.id === portId);
    }

    hasOutputPort(portId) {
        return this.constructor.outputPorts.some(p => p.id === portId);
    }

    // Geometry - override in subclasses for different shapes
    getWidth() {
        return this.collapsed ? 56 : 180;
    }

    getHeight() {
        return this.collapsed ? 56 : 80;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.getWidth(),
            height: this.getHeight()
        };
    }

    isCircular() {
        return false;
    }

    getPortPosition(portId, isInput) {
        const bounds = this.getBounds();
        const ports = isInput ? this.getInputPorts() : this.getOutputPorts();
        const portIndex = ports.findIndex(p => p.id === portId);
        const portCount = ports.length;

        if (this.isCircular()) {
            const cx = bounds.x + bounds.width / 2;
            const cy = bounds.y + bounds.height / 2;
            const radius = bounds.width / 2;

            if (isInput) {
                return { x: cx, y: cy - radius };
            } else {
                return { x: cx, y: cy + radius };
            }
        }

        if (this.collapsed) {
            const cx = bounds.x + bounds.width / 2;
            return {
                x: cx,
                y: isInput ? bounds.y : bounds.y + bounds.height
            };
        }

        // Multiple ports distributed horizontally
        const portWidth = bounds.width / (portCount + 1);
        const x = bounds.x + portWidth * (portIndex + 1);
        const y = isInput ? bounds.y : bounds.y + bounds.height;

        return { x, y };
    }

    // IEnricher - override in subclasses
    enrich(message) {
        // Default: pass through
        return {
            message: message.withPath(this.id),
            outputPort: 'output',
            delay: 0
        };
    }

    // IValidatable
    validate() {
        return { valid: true, errors: [] };
    }

    // ISerializable
    serialize() {
        return {
            id: this.id,
            type: this.getType(),
            position: { x: this.x, y: this.y },
            collapsed: this.collapsed,
            customTitle: this.customTitle,
            properties: { ...this.properties }
        };
    }

    static deserialize(data) {
        // This should be called on the specific subclass
        throw new Error('deserialize must be called on specific node class');
    }

    // Utility methods
    setProperty(key, value) {
        if (key in this.properties) {
            this.properties[key] = value;
        }
    }

    getProperty(key) {
        return this.properties[key];
    }

    moveTo(x, y) {
        this.x = x;
        this.y = y;
    }

    moveBy(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    setSelected(selected) {
        this.selected = selected;
    }

    setHovered(hovered) {
        this.hovered = hovered;
    }

    setCollapsed(collapsed) {
        this.collapsed = collapsed;
    }

    toggleCollapsed() {
        this.collapsed = !this.collapsed;
    }

    setRunState(state, data = null) {
        this.runState = state;
        this.runData = data;
    }

    resetRunState() {
        this.runState = 'idle';
        this.runData = null;
    }

    clone(newX, newY) {
        const cloned = new this.constructor(newX, newY);
        cloned.collapsed = this.collapsed;
        cloned.properties = { ...this.properties };
        return cloned;
    }
}
