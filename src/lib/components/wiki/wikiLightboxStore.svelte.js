let _open = $state(false);
let _src  = $state('');
let _alt  = $state('');

export const lightbox = {
  get open() { return _open; },
  get src()  { return _src;  },
  get alt()  { return _alt;  },
};

/** @param {string} src @param {string} [alt] */
export function openLightbox(src, alt = '') {
  const trimmed = src?.trim() ?? '';
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower.startsWith('javascript:') || lower.startsWith('data:text') || lower.startsWith('data:application/')) {
    console.warn('🚫 openLightbox: Blocked unsafe URL:', src);
    return;
  }
  _src  = trimmed;
  _alt  = alt;
  _open = true;
}

export function closeLightbox() {
  _open = false;
}
