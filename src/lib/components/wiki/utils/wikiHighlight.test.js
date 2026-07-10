import { describe, it, expect } from 'vitest';
import { splitByTerms } from './wikiHighlight.js';

describe('splitByTerms', () => {
  it('markiert einzelne Treffer case-insensitiv', () => {
    expect(splitByTerms('Großes Gebäude bauen', 'gebäude')).toEqual([
      { text: 'Großes ', hit: false },
      { text: 'Gebäude', hit: true },
      { text: ' bauen', hit: false }
    ]);
  });

  it('markiert mehrere Begriffe und Teilwörter', () => {
    const parts = splitByTerms('Buchaktion: Buch nehmen', 'buch nehmen');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Buch', 'Buch', 'nehmen']);
  });

  it('ist robust gegen Regex-Sonderzeichen und leere Eingaben', () => {
    expect(splitByTerms('Kosten (2+)', '(2+)')).toEqual([
      { text: 'Kosten ', hit: false },
      { text: '(2+)', hit: true }
    ]);
    expect(splitByTerms('Text', '')).toEqual([{ text: 'Text', hit: false }]);
    expect(splitByTerms('', 'foo')).toEqual([]);
  });
});
