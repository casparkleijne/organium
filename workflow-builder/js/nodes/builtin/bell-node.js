/**
 * BellNode - plays an audio notification and passes message through
 */
import { DataNode } from '../abstract/data-node.js';
import { NodeRegistry } from '../../core/registry.js';

export class BellNode extends DataNode {
    static type = 'bell';
    static category = 'Action';
    static displayName = 'Bell';
    static icon = 'notifications';
    static color = '#F48FB1';

    static propertySchema = [
        {
            key: 'sound',
            type: 'select',
            label: 'Sound',
            defaultValue: 'chime',
            options: [
                { value: 'chime', label: 'Chime' },
                { value: 'bell', label: 'Bell' },
                { value: 'alert', label: 'Alert' },
                { value: 'success', label: 'Success' },
                { value: 'error', label: 'Error' },
                { value: 'notification', label: 'Notification' }
            ]
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
            sound: this.properties.sound,
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
            const volume = (this.properties.volume || 70) / 100;
            const sound = this.properties.sound || 'chime';
            const duration = this._getDurationSeconds();

            // Create oscillator-based sounds
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Configure sound based on type
            const soundConfig = this._getSoundConfig(sound);
            oscillator.type = soundConfig.type;
            oscillator.frequency.setValueAtTime(soundConfig.freq, ctx.currentTime);

            // Apply frequency modulation for some sounds
            if (soundConfig.freqEnd) {
                oscillator.frequency.exponentialRampToValueAtTime(
                    soundConfig.freqEnd,
                    ctx.currentTime + duration
                );
            }

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

    _getSoundConfig(sound) {
        const configs = {
            chime: { type: 'sine', freq: 880, freqEnd: 440 },
            bell: { type: 'sine', freq: 660, freqEnd: 330 },
            alert: { type: 'square', freq: 440, freqEnd: 220 },
            success: { type: 'sine', freq: 523, freqEnd: 784 },
            error: { type: 'sawtooth', freq: 220, freqEnd: 110 },
            notification: { type: 'triangle', freq: 740, freqEnd: 587 }
        };
        return configs[sound] || configs.chime;
    }

    getPreviewText() {
        return `${this.properties.sound} (${this.properties.volume}%)`;
    }
}

NodeRegistry.register(BellNode);
