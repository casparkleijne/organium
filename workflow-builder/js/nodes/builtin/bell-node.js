/**
 * BellNode - plays audio notification and passes message through
 */
import { DataNode } from '../abstract/data-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class BellNode extends DataNode {
    static type = 'bell';
    static category = 'Action';
    static displayName = 'Bell';
    static icon = 'notifications';
    static color = '#EC407A'; // Pink - action output

    static propertySchema = [
        {
            key: 'frequency',
            type: 'range',
            label: 'Frequency (Hz)',
            defaultValue: 440,
            min: 100,
            max: 1000
        },
        {
            key: 'volume',
            type: 'range',
            label: 'Volume',
            defaultValue: 70,
            min: 0,
            max: 100
        },
        {
            key: 'duration',
            type: 'select',
            label: 'Duration',
            defaultValue: 'medium',
            options: [
                { value: 'short', label: 'Short' },
                { value: 'medium', label: 'Medium' },
                { value: 'long', label: 'Long' }
            ]
        }
    ];

    static inputPorts = [{ id: 'input', position: 'top' }];
    static outputPorts = [{ id: 'output', position: 'bottom' }];

    // Audio context singleton
    static audioContext = null;

    static getAudioContext() {
        if (!BellNode.audioContext) {
            BellNode.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return BellNode.audioContext;
    }

    getHeight() {
        return this.collapsed ? 56 : 100;
    }

    getKeyToAdd() {
        return `_bell_${this.id}`;
    }

    getValueToAdd() {
        return {
            frequency: this.properties.frequency ?? 440,
            playedAt: Date.now()
        };
    }

    enrich(message) {
        // Play the sound (non-blocking)
        this._playSound();

        // Return enriched message immediately
        return super.enrich(message);
    }

    _playSound() {
        try {
            const ctx = BellNode.getAudioContext();
            const frequency = this.properties.frequency ?? 440;
            const volume = (this.properties.volume ?? 70) / 100;
            const duration = this._getDurationSeconds();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Configurable frequency sine wave
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            // Volume envelope
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Bell audio playback failed:', e);
        }
    }

    _getDurationSeconds() {
        switch (this.properties.duration) {
            case 'short': return 0.15;
            case 'long': return 0.6;
            case 'medium':
            default: return 0.3;
        }
    }

    getPreviewText() {
        const freq = this.properties.frequency ?? 440;
        return `${freq} Hz`;
    }
}

NodeRegistry.register(BellNode);
