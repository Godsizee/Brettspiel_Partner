import { describe, it, expect } from 'vitest';
import { groupCategories } from './sections.js';
import { categoryIconUrl } from './categoryIcon.js';
import { makeSvgIcon } from './categoryGlyphs.js';

describe('groupCategories', () => {
  const template = {
    categories: [
      { id: 'a', section: 'Spiel' }, { id: 'b' }, { id: 'c', section: 'Spiel' }, { id: 'd', section: 'Ende' },
    ],
    expansion: { extraCategories: [{ id: 'x', section: 'Neu' }, { id: 'y', section: 'Ende' }] },
  };

  it('ordnet nach erstem Auftreten und fasst gleiche Sektionen zusammen', () => {
    const g = groupCategories(template);
    expect(g.map((s) => s.name)).toEqual(['Spiel', '', 'Ende', 'Neu']);
    expect(g[0].cats.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('markiert reine Erweiterungs-Sektionen und -Kategorien', () => {
    const g = groupCategories(template);
    expect(g.find((s) => s.name === 'Neu')?.expansionOnly).toBe(true);
    expect(g.find((s) => s.name === 'Ende')?.expansionOnly).toBe(false);
    expect(g.find((s) => s.name === 'Ende')?.cats.map((c) => c.isExpansion)).toEqual([false, true]);
  });

  it('kommt ohne Template zurecht', () => {
    expect(groupCategories(null)).toEqual([]);
  });
});

describe('categoryIconUrl', () => {
  it('normalisiert Pfade wie der alte Bogen (S17)', () => {
    const base = import.meta.env.BASE_URL;
    expect(categoryIconUrl('/files/Brettspiel_Partner/images/x/03_arbeiter wohnbereich.png')).toBe(`${base}images/x/03_arbeiter wohnbereich.webp`);
    expect(categoryIconUrl('/images/a.webp')).toBe(`${base}images/a.webp`);
    expect(categoryIconUrl(undefined)).toBe('');
    expect(categoryIconUrl('javascript:alert(1)')).toBe('');
  });
});

describe('makeSvgIcon', () => {
  it('blockt gefährliche Farben und fällt auf star zurück', () => {
    const svg = makeSvgIcon('gibt-es-nicht', 'red;background:url(x)');
    expect(svg).toContain('color:currentColor');
    expect(svg).toContain('<polygon points="12 2 15.09');
  });
});
