/**
 * Immutable Message class for workflow data flow
 */
import { createGUID } from '../utils/guid.js';

export class Message {
    constructor(createdBy, payload = {}, metadata = null) {
        this.id = createGUID();
        this.createdAt = Date.now();
        this.createdBy = createdBy;
        this.payload = Object.freeze({ ...payload });
        this.metadata = Object.freeze(metadata || {
            path: [],
            branchId: createGUID(),
            parentMessageId: null
        });
        Object.freeze(this);
    }

    withPayload(additions) {
        const newPayload = { ...this.payload, ...additions };
        const msg = Object.create(Message.prototype);
        msg.id = this.id;
        msg.createdAt = this.createdAt;
        msg.createdBy = this.createdBy;
        msg.payload = Object.freeze(newPayload);
        msg.metadata = this.metadata;
        return Object.freeze(msg);
    }

    withPath(nodeId) {
        const msg = Object.create(Message.prototype);
        msg.id = this.id;
        msg.createdAt = this.createdAt;
        msg.createdBy = this.createdBy;
        msg.payload = this.payload;
        msg.metadata = Object.freeze({
            ...this.metadata,
            path: [...this.metadata.path, nodeId]
        });
        return Object.freeze(msg);
    }

    fork(branchIndex, totalBranches) {
        const msg = Object.create(Message.prototype);
        msg.id = createGUID();
        msg.createdAt = this.createdAt;
        msg.createdBy = this.createdBy;
        msg.payload = Object.freeze({
            ...this.payload,
            [`_split_${this.metadata.path[this.metadata.path.length - 1]}`]: {
                branchCount: totalBranches,
                branchIndex: branchIndex
            }
        });
        msg.metadata = Object.freeze({
            path: [...this.metadata.path],
            branchId: createGUID(),
            parentMessageId: this.id
        });
        return Object.freeze(msg);
    }

    static merge(messages, nodeId) {
        if (messages.length === 0) return null;
        if (messages.length === 1) return messages[0];

        const mergedPayload = {};
        const paths = [];

        messages.forEach(msg => {
            Object.assign(mergedPayload, msg.payload);
            paths.push(...msg.metadata.path);
        });

        mergedPayload[`_merged_${nodeId}`] = {
            arrivedCount: messages.length,
            mergedFrom: messages.map(m => m.id)
        };

        const msg = Object.create(Message.prototype);
        msg.id = createGUID();
        msg.createdAt = Date.now();
        msg.createdBy = messages[0].createdBy;
        msg.payload = Object.freeze(mergedPayload);
        msg.metadata = Object.freeze({
            path: [...new Set(paths)],
            branchId: createGUID(),
            parentMessageId: messages.map(m => m.id)
        });
        return Object.freeze(msg);
    }

    getPayloadValue(key) {
        return this.payload[key];
    }

    hasPayloadKey(key) {
        return key in this.payload;
    }
}
