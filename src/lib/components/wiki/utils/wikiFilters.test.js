import { describe, it, expect } from 'vitest';
import { collectFilterOptions, filterEntries, collectCategories, collectTimings } from './wikiFilters.js';

const ENTRIES = [
  { id: '1', name: 'A', category: 'Aktionen', timing: ['Runde', 'Ende'],   edition: '2021', expansion: 'Promo' },
  { id: '2', name: 'B', category: 'Boni',     timing: ['Sofort'],          edition: '2021', expansion: undefined },
  { id: '3', name: 'C', category: 'Karten',   timing: ['Ende'],            edition: '2023', expansion: 'Deluxe' },
  { id: '4', name: 'D', category: 'Aktionen', timing: [],                  edition: undefined, expansion: undefined },
];

describe('collectFilterOptions', () => {
  it('gibt für leere Eingabe Arrays mit nur "all" zurück', () => {
    const opts = collectFilterOptions([]);
    expect(opts.categories).toEqual(['all']);
    expect(opts.timings).toEqual(['all']);
    expect(opts.editions).toEqual(['all']);
    expect(opts.expansions).toEqual(['all']);
  });

  it('gibt für fehlende Eingabe Arrays mit nur "all" zurück', () => {
    const opts = collectFilterOptions();
    expect(opts.categories).toEqual(['all']);
  });

  it('sammelt Kategorien aus den Einträgen, "all" ist erstes Element', () => {
    const opts = collectFilterOptions(ENTRIES);
    expect(opts.categories[0]).toBe('all');
    expect(opts.categories).toContain('Aktionen');
    expect(opts.categories).toContain('Boni');
    expect(opts.categories).toContain('Karten');
  });

  it('sammelt Timings aus verschachtelten Arrays', () => {
    const opts = collectFilterOptions(ENTRIES);
    expect(opts.timings[0]).toBe('all');
    expect(opts.timings).toContain('Runde');
    expect(opts.timings).toContain('Ende');
    expect(opts.timings).toContain('Sofort');
  });

  it('sammelt Editions und Expansions', () => {
    const opts = collectFilterOptions(ENTRIES);
    expect(opts.editions).toContain('2021');
    expect(opts.editions).toContain('2023');
    expect(opts.expansions).toContain('Promo');
    expect(opts.expansions).toContain('Deluxe');
  });

  it('dedupliziert Werte', () => {
    const opts = collectFilterOptions(ENTRIES);
    // "Aktionen" und "Ende" kommen je zweimal in den Einträgen vor
    const categoryCount = opts.categories.filter(c => c === 'Aktionen').length;
    const timingCount = opts.timings.filter(t => t === 'Ende').length;
    expect(categoryCount).toBe(1);
    expect(timingCount).toBe(1);
  });

  it('ignoriert fehlende (undefined/null) Werte', () => {
    const opts = collectFilterOptions(ENTRIES);
    expect(opts.editions).not.toContain(undefined);
    expect(opts.expansions).not.toContain(undefined);
  });

  it('sortiert Werte alphabetisch (nach "all")', () => {
    const opts = collectFilterOptions(ENTRIES);
    const withoutAll = opts.categories.slice(1);
    expect(withoutAll).toEqual([...withoutAll].sort());
  });
});

describe('filterEntries', () => {
  it('gibt bei leeren Filtern alle Einträge zurück', () => {
    expect(filterEntries(ENTRIES, {})).toEqual(ENTRIES);
    expect(filterEntries(ENTRIES)).toEqual(ENTRIES);
  });

  it('gibt bei leerer Eintrags-Liste ein leeres Array zurück', () => {
    expect(filterEntries([], { category: 'Aktionen' })).toEqual([]);
    expect(filterEntries()).toEqual([]);
  });

  it('filtert nach Kategorie', () => {
    const result = filterEntries(ENTRIES, { category: 'Aktionen' });
    expect(result).toHaveLength(2);
    expect(result.every(e => e.category === 'Aktionen')).toBe(true);
  });

  it('"all" als Kategorie-Filter gibt alle zurück', () => {
    expect(filterEntries(ENTRIES, { category: 'all' })).toEqual(ENTRIES);
  });

  it('filtert nach Timing', () => {
    const result = filterEntries(ENTRIES, { timing: 'Sofort' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('"all" als Timing-Filter gibt alle zurück', () => {
    expect(filterEntries(ENTRIES, { timing: 'all' })).toEqual(ENTRIES);
  });

  it('filtert nach Edition', () => {
    const result = filterEntries(ENTRIES, { edition: '2023' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filtert nach Expansion', () => {
    const result = filterEntries(ENTRIES, { expansion: 'Promo' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('kombiniert mehrere Filter (Schnittmenge)', () => {
    // Eintrag 1: Aktionen + Ende → passt auf beide Filter
    const result = filterEntries(ENTRIES, { category: 'Aktionen', timing: 'Ende' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('gibt leeres Array zurück wenn kein Eintrag alle Filter erfüllt', () => {
    const result = filterEntries(ENTRIES, { category: 'Boni', timing: 'Runde' });
    expect(result).toHaveLength(0);
  });
});

describe('collectCategories', () => {
  it('gibt eindeutige Kategorien zurück', () => {
    const cats = collectCategories(ENTRIES);
    expect(cats).toContain('Aktionen');
    expect(cats).toContain('Boni');
    expect(cats).toContain('Karten');
    expect(cats.filter(c => c === 'Aktionen')).toHaveLength(1);
  });

  it('ignoriert Einträge ohne Kategorie', () => {
    const result = collectCategories([{ id: '1', name: 'X' }]);
    expect(result).toEqual([]);
  });
});

describe('collectTimings', () => {
  it('gibt eindeutige Timings aus verschachtelten Arrays zurück', () => {
    const timings = collectTimings(ENTRIES);
    expect(timings).toContain('Runde');
    expect(timings).toContain('Ende');
    expect(timings).toContain('Sofort');
    expect(timings.filter(t => t === 'Ende')).toHaveLength(1);
  });

  it('gibt leeres Array zurück wenn keine Timings vorhanden', () => {
    expect(collectTimings([{ id: '1', name: 'X' }])).toEqual([]);
    expect(collectTimings([{ id: '1', timing: [] }])).toEqual([]);
  });
});
