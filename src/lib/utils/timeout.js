// @ts-check
/**
 * Custom fetch wrapper that aborts the request after a specified timeout duration.
 * @param {string|URL} url The request URL or URL object
 * @param {RequestInit} [options={}] Standard fetch options
 * @param {number} [timeoutMs=30000] Timeout in milliseconds (default 30 seconds)
 * @returns {Promise<Response>}
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}
