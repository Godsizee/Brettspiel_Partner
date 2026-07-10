import { describe, it, expect } from 'vitest';
import { toSlug, toAppKey } from './wikiKeys.js';

// Alle Slugs aus static/data/wiki/games.json müssen den Roundtrip überleben.
const CATALOG_SLUGS = [
  'age-of-innovation',
  'on-mars',
  'arche-nova',
  'hallertau',
  'sattgruen',
  'revive',
  'voidfall',
  'fluegelschlag'
];

describe('wikiKeys', () => {
  it('mapped Sonderfälle in beide Richtungen', () => {
    expect(toSlug('on mars')).toBe('on-mars');
    expect(toAppKey('on-mars')).toBe('on mars');
    expect(toSlug('wingspan')).toBe('fluegelschlag');
    expect(toAppKey('fluegelschlag')).toBe('wingspan');
  });

  it('mapped Unterstrich-Keys auf Bindestrich-Slugs', () => {
    expect(toSlug('la_granja')).toBe('la-granja');
    expect(toAppKey('la-granja')).toBe('la_granja');
    expect(toSlug('underwater_cities')).toBe('underwater-cities');
    expect(toSlug('age_of_innovation')).toBe('age-of-innovation');
  });

  it('lässt einteilige Keys unverändert', () => {
    expect(toSlug('voidfall')).toBe('voidfall');
    expect(toAppKey('voidfall')).toBe('voidfall');
  });

  it('Roundtrip slug → appKey → slug ist stabil für alle Katalog-Slugs', () => {
    for (const slug of CATALOG_SLUGS) {
      expect(toSlug(toAppKey(slug))).toBe(slug);
    }
  });

  it('ist robust gegen leere Eingaben', () => {
    expect(toSlug('')).toBe('');
    expect(toAppKey('')).toBe('');
  });
});
