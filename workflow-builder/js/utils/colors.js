/**
 * Color utilities
 */

export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

export function withAlpha(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function lighten(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return rgbToHex(
        Math.min(255, rgb.r + amount),
        Math.min(255, rgb.g + amount),
        Math.min(255, rgb.b + amount)
    );
}

export function darken(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return rgbToHex(
        Math.max(0, rgb.r - amount),
        Math.max(0, rgb.g - amount),
        Math.max(0, rgb.b - amount)
    );
}

export function getContrastColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#FFFFFF';
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
