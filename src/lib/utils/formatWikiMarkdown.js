// @ts-check
import DOMPurify from 'dompurify';

/** @type {import('dompurify').Config} */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['strong', 'em', 'ul', 'ol', 'li', 'p', 'br', 'h4', 'code', 'img'],
  ALLOWED_ATTR: ['class', 'src', 'alt'],
  ALLOW_DATA_ATTR: false,
};

// Hook to ensure img tags only load from the internal icons path
DOMPurify.addHook('uponSanitizeAttribute', function (node, data) {
  if (data.attrName === 'src' && node.nodeName === 'IMG') {
    if (!data.attrValue.match(/^\/images\/voidfall\/icons\/icon-[a-z0-9-]+\.png$/)) {
      data.keepAttr = false;
    }
  }
});

/**
 * Converts simple Markdown to sanitized HTML.
 * Supports: **bold**, *italic*, unordered lists (-, *, •), paragraphs, bold-only lines as h4.
 * Output is sanitized with DOMPurify before return.
 * @param {string} md
 * @returns {string}
 */
export function formatWikiMarkdown(md) {
  if (!md) return '';

  // HTML-escape raw input before markdown transforms to prevent injection
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text** → <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* → <em>text</em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Icons: [[icon:slug]] → <img class="wiki-inline-icon" src="/images/voidfall/icons/icon-slug.png" alt="slug">
  html = html.replace(/\[\[icon:([a-z0-9-]+)\]\]/g, '<img class="wiki-inline-icon" src="/images/voidfall/icons/icon-$1.png" alt="$1">');

  const lines = html.split('\n');
  const output = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      if (!inList) {
        output.push('<ul class="list-disc pl-5 my-2 space-y-1.5 text-[var(--color-text-secondary)]">');
        inList = true;
      }
      output.push(`<li>${trimmed.substring(2).trim()}</li>`);
    } else {
      if (inList) {
        output.push('</ul>');
        inList = false;
      }

      if (trimmed) {
        if (trimmed.startsWith('<strong>') && trimmed.endsWith('</strong>')) {
          output.push(`<h4 class="text-sm sm:text-base font-bold text-[var(--color-text-primary)] mt-5 mb-2">${trimmed}</h4>`);
        } else {
          output.push(`<p class="m-0 leading-relaxed text-[var(--color-text-secondary)] mb-3">${trimmed}</p>`);
        }
      }
    }
  }

  if (inList) output.push('</ul>');

  return DOMPurify.sanitize(output.join('\n'), PURIFY_CONFIG);
}

/**
 * Sanitizes already-valid HTML (e.g. from PocketBase editor fields) without Markdown conversion.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeWikiHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
