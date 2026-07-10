// @ts-check

/**
 * Svelte Action für Focus-Trapping in modalen Dialogen.
 * Verhindert, dass der Tastaturfokus das Modal verlässt.
 * @param {HTMLElement} node Das Container-Element des Modals.
 */
export function trapFocus(node) {
  const previousFocus = /** @type {HTMLElement} */ (document.activeElement);

  function getFocusableElements() {
    return Array.from(
      node.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (el) =>
        !el.hasAttribute('disabled') &&
        !el.getAttribute('aria-hidden') &&
        /** @type {HTMLElement} */ (el).offsetParent !== null
    );
  }

  function handleKeydown(/** @type {KeyboardEvent} */ event) {
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Rückwärts (Shift + Tab)
      if (document.activeElement === firstElement) {
        /** @type {HTMLElement} */ (lastElement).focus();
        event.preventDefault();
      }
    } else {
      // Vorwärts (Tab)
      if (document.activeElement === lastElement) {
        /** @type {HTMLElement} */ (firstElement).focus();
        event.preventDefault();
      }
    }
  }

  // Fokus initial auf das erste interaktive Element setzen
  setTimeout(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      /** @type {HTMLElement} */ (focusableElements[0]).focus();
    } else {
      node.focus();
    }
  }, 10);

  node.addEventListener('keydown', handleKeydown);

  return {
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        // Fokus wieder zurückgeben
        setTimeout(() => previousFocus.focus(), 10);
      }
    }
  };
}
