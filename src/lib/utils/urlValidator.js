// @ts-check
import { get } from 'svelte/store';
import { pocketbaseHost } from '../stores/app.js';

/**
 * ==========================================================================
 * URL & STYLE VALUE VALIDATOR
 * ==========================================================================
 * Validates URLs and CSS values to prevent CSS injection and XSS
 * Used in GameSelection.svelte for cover images and gradient colors
 */

/**
 * Validate and sanitize game cover image URL
 * Allows: HTTPS URLs, HTTP localhost URLs, relative paths, data URLs
 * Blocks: javascript:, expression(), and other dangerous protocols
 * 
 * @param {string|null|undefined} url URL to validate
 * @returns {string|null} Safe URL or null if invalid
 */
export function validateGameImageUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const trimmedUrl = url.trim();

    // Dangerous patterns to block
    if (trimmedUrl.startsWith('javascript:') || 
        trimmedUrl.startsWith('data:text/html') ||
        trimmedUrl.startsWith('data:application/javascript') ||
        trimmedUrl.includes('expression(') ||
        trimmedUrl.includes('*/') ||
        trimmedUrl.includes('/*') ||
        trimmedUrl.includes('\\') ||
        trimmedUrl.includes('"') ||
        trimmedUrl.includes("'")) {
        console.warn('🚫 Blocked dangerous URL:', url);
        return null;
    }

    // Allow: HTTPS absolute URLs
    if (trimmedUrl.startsWith('https://')) {
        try {
            const urlObj = new URL(trimmedUrl);
            
            // Only allow image file extensions
            const pathname = urlObj.pathname.toLowerCase();
            if (!/(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)$/i.test(pathname)) {
                console.warn('🚫 validateGameImageUrl: Blocked HTTPS URL due to invalid file extension in path:', trimmedUrl);
                return null;
            }
            
            // Limit URL length to prevent DoS
            if (trimmedUrl.length > 500) {
                console.warn('🚫 validateGameImageUrl: Blocked HTTPS URL because length exceeds 500 chars:', trimmedUrl);
                return null;
            }
            
            return trimmedUrl;
        } catch (e) {
            console.warn('🚫 validateGameImageUrl: Blocked HTTPS URL due to parsing error:', trimmedUrl, e);
            return null;
        }
    }

    // Allow: HTTP localhost/dev or configured PocketBase host URLs
    const pbHost = get(pocketbaseHost);
    if (trimmedUrl.startsWith('http://localhost') || 
        trimmedUrl.startsWith('http://127.0.0.1') || 
        (pbHost && trimmedUrl.startsWith(pbHost))) {
        try {
            const urlObj = new URL(trimmedUrl);
            const pathname = urlObj.pathname.toLowerCase();
            if (!/(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)$/i.test(pathname)) {
                console.warn('🚫 validateGameImageUrl: Blocked HTTP URL due to invalid file extension in path:', trimmedUrl);
                return null;
            }
            if (trimmedUrl.length > 500) {
                console.warn('🚫 validateGameImageUrl: Blocked HTTP URL because length exceeds 500 chars:', trimmedUrl);
                return null;
            }
            return trimmedUrl;
        } catch (e) {
            console.warn('🚫 validateGameImageUrl: Blocked HTTP URL due to parsing error:', trimmedUrl, e);
            return null;
        }
    }

    // Allow: Safe data URLs (images only)
    if (trimmedUrl.startsWith('data:image/')) {
        // SVG kann JavaScript enthalten → explizit blocken
        if (trimmedUrl.startsWith('data:image/svg') || trimmedUrl.includes('image/svg+xml')) {
            console.warn('🚫 validateGameImageUrl: Blocked SVG data URL (potential XSS):', url);
            return null;
        }
        // Limit data URL length to prevent memory issues
        if (trimmedUrl.length > 100000) {
            console.warn('🚫 validateGameImageUrl: Blocked data URL because length exceeds 100000 chars:', trimmedUrl.substring(0, 50) + '...');
            return null;
        }
        return trimmedUrl;
    }

    // Allow: Relative paths (local assets)
    if (trimmedUrl.startsWith('./') || 
        trimmedUrl.startsWith('../') ||
        trimmedUrl.startsWith('/')) {
        
        // Don't allow suspicious patterns in paths (prevent directory traversal attacks)
        // Allow single ../ for parent directory, but block multiple traversals
        const parentTraversals = (trimmedUrl.match(/\.\.\//g) || []).length;
        if (parentTraversals > 2) {
            console.warn('🚫 validateGameImageUrl: Blocked relative URL due to too many parent traversals:', trimmedUrl);
            return null;
        }
        
        // Verify it ends with an image extension
        if (!/(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)$/i.test(trimmedUrl)) {
            console.warn('🚫 validateGameImageUrl: Blocked relative URL due to invalid file extension:', trimmedUrl);
            return null;
        }
        
        // Auto-prepend BASE_URL if it is an absolute path that doesn't start with BASE_URL
        if (trimmedUrl.startsWith('/')) {
            const base = import.meta.env.BASE_URL || '/';
            if (base !== '/' && !trimmedUrl.startsWith(base)) {
                return base + trimmedUrl.substring(1);
            }
        }
        
        return trimmedUrl;
    }
    
    // Allow: Simple filenames without path separators (files in public root)
    if (/^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(trimmedUrl)) {
        return trimmedUrl;
    }

    // All other URLs are blocked
    console.warn('🚫 Blocked invalid/external URL:', url);
    return null;
}

/**
 * Validate CSS gradient color (hex format only)
 * Blocks: rgb(), rgba(), hsl(), expressions, etc.
 * 
 * @param {string|null|undefined} color Color value to validate
 * @returns {string|null} Valid hex color or null
 */
export function validateGradientColor(color) {
    if (!color || typeof color !== 'string') {
        return null;
    }

    const trimmedColor = color.trim();

    // Only allow hex colors (#RRGGBB or #RRGGBBAA)
    if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmedColor)) {
        return trimmedColor;
    }

    // Block dangerous patterns
    if (trimmedColor.includes('(') || 
        trimmedColor.includes(')') ||
        trimmedColor.includes('rgb') ||
        trimmedColor.includes('hsl') ||
        trimmedColor.includes('url') ||
        trimmedColor.includes('expression')) {
        console.warn('🚫 Blocked dangerous color value:', color);
    }

    return null;
}

/**
 * Validate CSS background-image value
 * @param {string|null|undefined} bgImage CSS background-image value
 * @returns {string|null} Safe value or null
 */
export function validateBackgroundImage(bgImage) {
    if (!bgImage || typeof bgImage !== 'string') {
        return null;
    }

    // Check if it's url() format
    const urlMatch = bgImage.match(/url\(['"']?(.+?)['"']?\)/);
    if (urlMatch) {
        const url = urlMatch[1];
        const validUrl = validateGameImageUrl(url);
        
        if (!validUrl) {
            return null;
        }

        // Return properly formatted url()
        return `url('${validUrl}')`;
    }

    return null;
}

/**
 * Safely create CSS background-image property with gradient and image
 * @param {string|null} imageUrl Image URL
 * @param {string|null} gradientColor Gradient color
 * @returns {string} Safe CSS value
 */
export function createSafeBackgroundImage(imageUrl, gradientColor) {
    const validColor = validateGradientColor(gradientColor) || '#6366f1';
    const validUrl = validateGameImageUrl(imageUrl);
    
    if (!validUrl) {
        // Return gradient only if no valid image
        return `linear-gradient(135deg, rgba(11,15,25,0.95) 0%, ${validColor}44 100%)`;
    }

    // Return gradient + image (light overlay at top, darker at bottom for text readability)
    return `linear-gradient(to bottom, rgba(11,15,25,0.15) 0%, rgba(11,15,25,0.75) 100%), url('${validUrl}')`;
}

/**
 * Validate CSS style string (basic protection)
 * @param {string} style CSS style string
 * @returns {boolean} True if style appears safe
 */
export function isStyleSafe(style) {
    if (!style || typeof style !== 'string') {
        return false;
    }

    // Block dangerous CSS functions
    const dangerous = [
        'expression(',
        'behavior:',
        'javascript:',
        '-moz-binding:',
        'binding:',
        'import',
        '@import'
    ];

    const lowerStyle = style.toLowerCase();
    for (const pattern of dangerous) {
        if (lowerStyle.includes(pattern)) {
            console.warn('🚫 Blocked dangerous CSS style:', style);
            return false;
        }
    }

    return true;
}

export default {
    validateGameImageUrl,
    validateGradientColor,
    validateBackgroundImage,
    createSafeBackgroundImage,
    isStyleSafe
};
