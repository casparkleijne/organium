/**
 * M3 Easing functions
 */

export const easing = {
    standard: t => {
        // cubic-bezier(0.2, 0, 0, 1)
        return cubicBezier(0.2, 0, 0, 1, t);
    },
    standardDecelerate: t => {
        // cubic-bezier(0, 0, 0, 1)
        return cubicBezier(0, 0, 0, 1, t);
    },
    standardAccelerate: t => {
        // cubic-bezier(0.3, 0, 1, 1)
        return cubicBezier(0.3, 0, 1, 1, t);
    },
    emphasized: t => {
        // cubic-bezier(0.2, 0, 0, 1)
        return cubicBezier(0.2, 0, 0, 1, t);
    },
    emphasizedDecelerate: t => {
        // cubic-bezier(0.05, 0.7, 0.1, 1)
        return cubicBezier(0.05, 0.7, 0.1, 1, t);
    },
    emphasizedAccelerate: t => {
        // cubic-bezier(0.3, 0, 0.8, 0.15)
        return cubicBezier(0.3, 0, 0.8, 0.15, t);
    },
    linear: t => t
};

function cubicBezier(p1x, p1y, p2x, p2y, t) {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    function sampleX(t) {
        return ((ax * t + bx) * t + cx) * t;
    }

    function sampleY(t) {
        return ((ay * t + by) * t + cy) * t;
    }

    function solveCurveX(x) {
        let t = x;
        for (let i = 0; i < 8; i++) {
            const currentX = sampleX(t) - x;
            if (Math.abs(currentX) < 1e-6) return t;
            const derivative = (3 * ax * t + 2 * bx) * t + cx;
            if (Math.abs(derivative) < 1e-6) break;
            t -= currentX / derivative;
        }
        return t;
    }

    return sampleY(solveCurveX(t));
}

export class Animation {
    constructor(target, property, from, to, duration, easingFn = easing.standard, onComplete = null) {
        this.target = target;
        this.property = property;
        this.from = from;
        this.to = to;
        this.duration = duration;
        this.easingFn = easingFn;
        this.onComplete = onComplete;
        this.startTime = null;
        this.completed = false;
    }

    start(time) {
        this.startTime = time;
    }

    update(time) {
        if (this.completed) return true;
        if (this.startTime === null) this.startTime = time;

        const elapsed = time - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);
        const easedProgress = this.easingFn(progress);

        if (typeof this.from === 'number') {
            this.target[this.property] = this.from + (this.to - this.from) * easedProgress;
        }

        if (progress >= 1) {
            this.completed = true;
            if (this.onComplete) this.onComplete();
            return true;
        }

        return false;
    }
}

export class AnimationManager {
    constructor() {
        this.animations = new Map();
        this.nextId = 0;
    }

    add(animation) {
        const id = this.nextId++;
        this.animations.set(id, animation);
        return id;
    }

    remove(id) {
        this.animations.delete(id);
    }

    update(time) {
        const completed = [];
        this.animations.forEach((anim, id) => {
            if (anim.update(time)) {
                completed.push(id);
            }
        });
        completed.forEach(id => this.animations.delete(id));
        return this.animations.size > 0;
    }

    clear() {
        this.animations.clear();
    }
}
