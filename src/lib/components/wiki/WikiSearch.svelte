<script>
  // @ts-check
  /**
   * Suchfeld (P4.2): Enter erzeugt einen History-Eintrag (push), Escape leert.
   * Die id wird vom Shortcut ('/') in ModularGameWiki zum Fokussieren genutzt.
   * @type {{
   *   value?: string,
   *   placeholder?: string,
   *   onInput?: (value: string) => void,
   *   onSubmit?: (value: string) => void
   * }}
   */
  let { value = '', placeholder = 'Suchen …', onInput = () => {}, onSubmit = () => {} } = $props();

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(input.value);
    } else if (e.key === 'Escape' && input.value) {
      // Escape leert erst das Feld; ein weiteres Escape darf weiter blubbern.
      e.preventDefault();
      e.stopPropagation();
      onInput('');
    }
  }
</script>

<div class="relative w-full group" role="search">
  <input
    id="wiki-search-input"
    class="wiki-input"
    type="search"
    {value}
    {placeholder}
    aria-label={placeholder}
    aria-keyshortcuts="/"
    oninput={(e) => onInput(/** @type {HTMLInputElement} */ (e.target).value)}
    onkeydown={handleKeydown}
  />
  <div class="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center transition-colors duration-200"
       style="color: var(--color-text-muted);">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  </div>
</div>
