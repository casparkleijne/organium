/**
 * Simple event emitter for pub/sub pattern
 */
export class EventEmitter {
    constructor() {
        this._events = new Map();
    }

    on(event, listener) {
        if (!this._events.has(event)) {
            this._events.set(event, new Set());
        }
        this._events.get(event).add(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        if (this._events.has(event)) {
            this._events.get(event).delete(listener);
        }
    }

    emit(event, ...args) {
        if (this._events.has(event)) {
            this._events.get(event).forEach(listener => {
                try {
                    listener(...args);
                } catch (e) {
                    console.error(`Error in event listener for ${event}:`, e);
                }
            });
        }
    }

    once(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener(...args);
        };
        return this.on(event, wrapper);
    }
}
