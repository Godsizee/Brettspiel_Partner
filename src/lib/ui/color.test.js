import { describe, it, expect } from 'vitest';
import { onColor, safeCssColor } from './color.js';

describe('onColor (Werte aus Plan C1.1)', () => {
  it.each([
    ['hsl(195, 85%, 50%)', '#1a1815'], ['hsl(12, 85%, 55%)', '#1a1815'], ['hsl(38, 90%, 55%)', '#1a1815'],
    ['hsl(270, 75%, 60%)', '#ffffff'], ['hsl(220, 80%, 55%)', '#ffffff'], ['#0f7a72', '#ffffff'], ['unsinn', '#1a1815'],
  ])('%s → %s', (c, expected) => expect(onColor(c)).toBe(expected));
});
describe('safeCssColor', () => {
  it('lässt Farben durch, blockt alles andere', () => {
    expect(safeCssColor('hsl(15, 89%, 60%)')).toBe('hsl(15, 89%, 60%)');
    expect(safeCssColor('red;background:url(x)')).toBe('');
  });
});
