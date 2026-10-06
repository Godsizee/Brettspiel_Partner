<script>
  import { fade } from 'svelte/transition';
  import { lightbox, closeLightbox } from './wikiLightboxStore.svelte.js';

  /** @type {HTMLButtonElement | null} */
  let closeBtn = $state(null);

  // Fokus beim Öffnen auf den Schließen-Button (Tastatur/Screenreader, P6.1)
  $effect(() => {
    if (lightbox.open) queueMicrotask(() => closeBtn?.focus?.());
  });

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
  }

  /** @param {MouseEvent} e */
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) closeLightbox();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if lightbox.open}
  <div
    class="lightbox-backdrop"
    transition:fade={{ duration: 180 }}
  >
    <button
      type="button"
      class="lightbox-backdrop-btn"
      onclick={handleBackdrop}
      aria-label="Schließen"
    ></button>
    <button
      bind:this={closeBtn}
      class="lightbox-close"
      type="button"
      onclick={closeLightbox}
      aria-label="Schließen"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- No overflow:hidden here — corners stay intact at scale(1.33) -->
    <div class="lightbox-stage">
      <img
        src={lightbox.src}
        alt={lightbox.alt}
        class="lightbox-img"
        draggable="false"
      />
    </div>
  </div>
{/if}

<style>
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }

  /* Contains the image — intentionally no overflow:hidden */
  .lightbox-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 1;
  }

  .lightbox-backdrop-btn {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    cursor: zoom-out;
    z-index: 0;
  }

  .lightbox-img {
    /* Fits within 66 % of the viewport, then scale(1.33) makes it ~88 % —
       the 33 % overflow is fully visible since no ancestor clips it. */
    max-width: 66vw;
    max-height: 66vh;
    width: auto;
    height: auto;
    object-fit: contain;
    transform: scale(1.33);
    transform-origin: center center;
    border-radius: var(--radius-lg);
    box-shadow: var(--sh-2);
    user-select: none;
    display: block;
    pointer-events: none;
  }

  .lightbox-close {
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
    z-index: 1;
    pointer-events: all;
  }

  .lightbox-close:hover {
    background: var(--surface-2);
  }
</style>
