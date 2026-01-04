/**
 * Executor - runs the workflow
 */
import { EventEmitter } from '../utils/event-emitter.js';
import { Message } from '../core/message.js';
import { Validator } from './validator.js';

export class Executor extends EventEmitter {
    constructor(store) {
        super();
        this.store = store;
        this.validator = new Validator(store);

        this.status = 'idle'; // 'idle' | 'running' | 'paused' | 'completed'
        this.speed = 1;

        this.activeMessages = new Map();
        this.pendingDelays = new Map();
        this.schedulerIntervals = new Map();
        this.pendingForwards = 0; // Track setTimeout forwards

        // Active connection animations
        this.activeConnectionAnimations = new Map(); // connId -> { startTime, duration }

        this.animationFrameId = null;
        this.lastUpdateTime = 0;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    isRunning() {
        return this.status === 'running';
    }

    isPaused() {
        return this.status === 'paused';
    }

    start() {
        if (this.status === 'running') return;

        if (this.status === 'paused') {
            this.resume();
            return;
        }

        // Validate workflow
        const validation = this.validator.validate();
        if (!validation.valid) {
            this.emit('validationError', validation.errors);
            return;
        }

        // Reset all nodes
        this.store.getNodes().forEach(node => node.resetRunState());

        // Reset all connections
        this.store.getConnections().forEach(conn => {
            if (conn.resetRunState) {
                conn.resetRunState();
            } else {
                conn.runState = 'idle';
                conn.messageProgress = 0;
            }
        });

        // Clear previous state
        this.activeMessages.clear();
        this.pendingDelays.clear();
        this.pendingForwards = 0;
        this.activeConnectionAnimations.clear();
        this._clearSchedulers();

        this.status = 'running';
        this.store.setExecutionStatus('running');
        this.emit('progressDimmingChanged', true);
        this.emit('started');

        // Start from all start/scheduler nodes
        this.store.getNodes().forEach(node => {
            const type = node.getType();

            if (type === 'start') {
                const message = node.createInitialMessage();
                this._processNode(node, message);
            } else if (type === 'scheduler') {
                this._startScheduler(node);
            }
        });

        // Also start data source nodes (nodes with no incoming connections)
        // These are typically Constant nodes that provide initial data
        this.store.getNodes().forEach(node => {
            const category = node.getCategory();
            if (category === 'Data') {
                const incomingConnections = this.store.getConnectionsToNode(node.id);
                if (incomingConnections.length === 0) {
                    // This is a data source node - auto-start it
                    const message = new Message();
                    this._processNode(node, message);
                }
            }
        });

        this._startLoop();
    }

    pause() {
        if (this.status !== 'running') return;
        this.status = 'paused';
        this.store.setExecutionStatus('paused');
        this._stopLoop();
        this.emit('paused');
    }

    resume() {
        if (this.status !== 'paused') return;
        this.status = 'running';
        this.store.setExecutionStatus('running');
        this._startLoop();
        this.emit('resumed');
    }

    stop() {
        this.status = 'idle';
        this.store.setExecutionStatus('idle');
        this._stopLoop();
        this._clearSchedulers();
        this.activeMessages.clear();
        this.pendingDelays.clear();
        this.pendingForwards = 0;
        this.activeConnectionAnimations.clear();

        // Reset all nodes
        this.store.getNodes().forEach(node => node.resetRunState());

        // Reset all connections
        this.store.getConnections().forEach(conn => {
            if (conn.resetRunState) {
                conn.resetRunState();
            } else {
                conn.runState = 'idle';
                conn.messageProgress = 0;
            }
        });

        this.emit('progressDimmingChanged', false);
        this.emit('stopped');
    }

    step() {
        // Execute one step
        if (this.status !== 'running' && this.status !== 'paused') {
            this.start();
            this.pause();
            return;
        }

        this._update(16); // Process one frame
    }

    _startLoop() {
        this.lastUpdateTime = performance.now();
        const loop = () => {
            if (this.status !== 'running') return;

            const now = performance.now();
            const dt = (now - this.lastUpdateTime) * this.speed;
            this.lastUpdateTime = now;

            this._update(dt);

            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    _stopLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _update(dt) {
        // Process pending delays
        const completedDelays = [];
        this.pendingDelays.forEach((delay, id) => {
            delay.remaining -= dt;
            delay.progress = 1 - (delay.remaining / delay.total);

            const node = this.store.getNode(delay.nodeId);
            if (node && node.setProgress) {
                node.setProgress(delay.progress);
            }

            if (delay.remaining <= 0) {
                completedDelays.push(id);
            }
        });

        completedDelays.forEach(id => {
            const delay = this.pendingDelays.get(id);
            this.pendingDelays.delete(id);

            const node = this.store.getNode(delay.nodeId);
            if (node) {
                node.setRunState('completed');
                this._forwardMessage(node, delay.result.message, delay.result.outputPort);
            }
        });

        // Update message dot animations
        const now = performance.now();
        this.activeConnectionAnimations.forEach((anim, connId) => {
            const conn = this.store.getConnection(connId);
            if (conn) {
                const elapsed = now - anim.startTime;
                conn.messageProgress = Math.min(elapsed / anim.duration, 1);
            }
        });

        // Check if workflow is complete
        if (this.activeMessages.size === 0 && this.pendingDelays.size === 0 &&
            this.schedulerIntervals.size === 0 && this.pendingForwards === 0) {
            this._complete();
        }

        this.store.emit('change');
    }

    _processNode(node, message) {
        node.setRunState('active');
        this.emit('nodeActivated', node);

        // Special handling for different node types
        const type = node.getType();

        if (type === 'gate') {
            this._processGate(node, message);
            return;
        }

        if (type === 'awaitall') {
            this._processAwaitAll(node, message);
            return;
        }

        // Normal processing
        const result = node.enrich(message);

        if (result.delay > 0) {
            // Delay node
            const delayId = `${node.id}_${Date.now()}`;
            this.pendingDelays.set(delayId, {
                nodeId: node.id,
                result: result,
                remaining: result.delay,
                total: result.delay,
                progress: 0
            });
            node.setRunState('waiting');
        } else {
            node.setRunState('completed');

            if (result.outputPort) {
                if (result.split) {
                    // Splitter node
                    this._splitMessage(node, result.message);
                } else if (result.repeat) {
                    // Repeater node
                    this._repeatMessage(node, result.message, result.outputPort, result.repeat);
                } else {
                    this._forwardMessage(node, result.message, result.outputPort);
                }
            } else {
                // End node
                this.emit('messageCompleted', result.message);
            }
        }
    }

    _processGate(node, message) {
        const connections = this.store.getConnectionsToNode(node.id);

        // Determine which port this message arrived on
        // For simplicity, we'll check by looking at the sender
        const isFromTrigger = connections.some(c =>
            c.toPortId === 'trigger' && message.metadata.path.includes(c.fromNodeId)
        );

        if (isFromTrigger) {
            node.receiveTrigger(message);
        } else {
            node.receiveData(message);
        }

        if (node.isReady()) {
            const result = node.enrich(message);
            node.setRunState('completed');
            this._forwardMessage(node, result.message, result.outputPort);
        } else {
            node.setRunState('waiting');
        }
    }

    _processAwaitAll(node, message) {
        // Count expected branches
        const incomingConnections = this.store.getConnectionsToNode(node.id);
        node.setExpectedCount(incomingConnections.length);

        const ready = node.receiveMessage(message);

        if (ready) {
            const result = node.enrich(message);
            node.setRunState('completed');
            this._forwardMessage(node, result.message, result.outputPort);
        } else {
            node.setRunState('waiting');
        }
    }

    _forwardMessage(fromNode, message, outputPort) {
        const connections = this.store.getConnectionsFromNode(fromNode.id);
        const relevantConnections = connections.filter(c => c.fromPortId === outputPort);

        relevantConnections.forEach(conn => {
            const targetNode = this.store.getNode(conn.toNodeId);
            if (targetNode) {
                // Track pending forward
                this.pendingForwards++;

                // Activate connection for animation
                if (conn.setRunState) {
                    conn.setRunState('active');
                } else {
                    conn.runState = 'active';
                    conn.messageProgress = 0;
                }
                const animationDuration = 300 / this.speed;
                this.activeConnectionAnimations.set(conn.id, {
                    startTime: performance.now(),
                    duration: animationDuration
                });

                // Delay before activating next node (with message dot animation)
                setTimeout(() => {
                    this.pendingForwards--;

                    // Mark connection as completed
                    if (conn.setRunState) {
                        conn.setRunState('completed');
                    } else {
                        conn.runState = 'completed';
                    }
                    this.activeConnectionAnimations.delete(conn.id);

                    if (this.status === 'running') {
                        this._processNode(targetNode, message);
                    }
                }, animationDuration);
            }
        });
    }

    _splitMessage(fromNode, message) {
        const connections = this.store.getConnectionsFromNode(fromNode.id);
        fromNode.setBranchCount(connections.length);

        connections.forEach((conn, index) => {
            const forkedMessage = message.fork(index, connections.length);
            const targetNode = this.store.getNode(conn.toNodeId);

            if (targetNode) {
                // Track pending forward
                this.pendingForwards++;

                // Activate connection for animation
                if (conn.setRunState) {
                    conn.setRunState('active');
                } else {
                    conn.runState = 'active';
                    conn.messageProgress = 0;
                }
                const animationDuration = 300 / this.speed;
                this.activeConnectionAnimations.set(conn.id, {
                    startTime: performance.now(),
                    duration: animationDuration
                });

                setTimeout(() => {
                    this.pendingForwards--;

                    // Mark connection as completed
                    if (conn.setRunState) {
                        conn.setRunState('completed');
                    } else {
                        conn.runState = 'completed';
                    }
                    this.activeConnectionAnimations.delete(conn.id);

                    if (this.status === 'running') {
                        this._processNode(targetNode, forkedMessage);
                    }
                }, animationDuration);
            }
        });
    }

    _repeatMessage(fromNode, message, outputPort, repeatConfig) {
        const { count, delay } = repeatConfig;

        const sendRepeat = (index) => {
            if (index >= count || this.status !== 'running') return;

            fromNode.setCurrentRepeat(index + 1);
            fromNode.setRunState('active');
            this.store.emit('change');

            // Clone the message for each repeat
            const repeatedMessage = message.fork(index, count);
            this._forwardMessage(fromNode, repeatedMessage, outputPort);

            // Schedule next repeat
            if (index + 1 < count) {
                this.pendingForwards++;
                setTimeout(() => {
                    this.pendingForwards--;
                    sendRepeat(index + 1);
                }, Math.max(delay, 100) / this.speed);
            } else {
                // All repeats done
                setTimeout(() => {
                    fromNode.setRunState('completed');
                    this.store.emit('change');
                }, 100 / this.speed);
            }
        };

        sendRepeat(0);
    }

    _startScheduler(node) {
        const interval = (node.properties.interval || 5) * 1000;

        const tick = () => {
            if (this.status !== 'running') return;
            if (!node.shouldContinue()) {
                this._clearScheduler(node.id);
                return;
            }

            const message = node.createInitialMessage();
            this._processNode(node, message);
        };

        // First tick immediately
        tick();

        // Then schedule subsequent ticks
        const intervalId = setInterval(tick, interval / this.speed);
        this.schedulerIntervals.set(node.id, intervalId);
    }

    _clearScheduler(nodeId) {
        const intervalId = this.schedulerIntervals.get(nodeId);
        if (intervalId) {
            clearInterval(intervalId);
            this.schedulerIntervals.delete(nodeId);
        }
    }

    _clearSchedulers() {
        this.schedulerIntervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.schedulerIntervals.clear();
    }

    _complete() {
        if (this.status !== 'running') return;
        this.status = 'completed';
        this.store.setExecutionStatus('completed');
        this._stopLoop();
        this.emit('completed');

        // Keep completed states visible for 3 seconds, then fade out
        setTimeout(() => {
            if (this.status === 'completed') {
                this.emit('progressDimmingChanged', false);

                // Reset node and connection states
                this.store.getNodes().forEach(node => node.resetRunState());
                this.store.getConnections().forEach(conn => {
                    if (conn.resetRunState) {
                        conn.resetRunState();
                    } else {
                        conn.runState = 'idle';
                        conn.messageProgress = 0;
                    }
                });
                this.store.emit('change');
            }
        }, 3000);
    }
}
