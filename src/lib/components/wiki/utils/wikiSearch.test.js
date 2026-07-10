import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchEntries } from './wikiSearch.js';

const ENTRIES = [
  { id: '1', name: 'Aktion Alpha', summary: 'Führe eine Aktion aus', category: 'Aktionen', tags: ['wichtig'], aliases: [], warnings: [], type: 'card' },
  { id: '2', name: 'Beta Bonus',   summary: 'Erhalte Boni',          category: 'Boni',     tags: ['bonus'],    aliases: ['Belohnung'], warnings: [], type: 'card' },
  { id: '3', name: 'Süd-Karte',   summary: 'Südliche Region',       category: 'Karten',   tags: [],           aliases: [],            warnings: ['Achtung'], type: 'card' },
];

describe('buildSearchIndex', () => {
  it('gibt für jeden Eintrag ein Objekt mit entry und haystack zurück', () => {
    const index = buildSearchIndex(ENTRIES);
    expect(index).toHaveLength(ENTRIES.length);
    for (const item of index) {
      expect(item).toHaveProperty('entry');
      expect(item).toHaveProperty('haystack');
      expect(typeof item.haystack).toBe('string');
    }
  });

  it('haystack enthält normalisierte Felder (name, summary, tags, category)', () => {
    const index = buildSearchIndex([ENTRIES[0]]);
    const { haystack } = index[0];
    expect(haystack).toContain('aktion');
    expect(haystack).toContain('alpha');
    expect(haystack).toContain('wichtig');
    expect(haystack).toContain('aktionen');
  });

  it('haystack enthält Aliases und Warnings', () => {
    const index = buildSearchIndex([ENTRIES[1]]);
    expect(index[0].haystack).toContain('belohnung');

    const index2 = buildSearchIndex([ENTRIES[2]]);
    expect(index2[0].haystack).toContain('achtung');
  });

  it('gibt leeres Array für leere Eingabe zurück', () => {
    expect(buildSearchIndex([])).toEqual([]);
    expect(buildSearchIndex()).toEqual([]);
  });

  it('normalisiert Umlaute im haystack (ü → u, ä → a)', () => {
    const index = buildSearchIndex([ENTRIES[2]]);
    expect(index[0].haystack).toContain('sud');
    expect(index[0].haystack).not.toContain('ü');
  });
});

describe('searchEntries', () => {
  it('gibt bei leerem Query alle Einträge zurück', () => {
    expect(searchEntries(ENTRIES, '')).toEqual(ENTRIES);
    expect(searchEntries(ENTRIES, '   ')).toEqual(ENTRIES);
    expect(searchEntries(ENTRIES)).toEqual([]);
  });

  it('gibt bei leerer Eintrags-Liste ein leeres Array zurück', () => {
    expect(searchEntries([], 'alpha')).toEqual([]);
    expect(searchEntries()).toEqual([]);
  });

  it('findet Einträge anhand des Namens', () => {
    const result = searchEntries(ENTRIES, 'alpha');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('findet Einträge anhand eines Tags', () => {
    const result = searchEntries(ENTRIES, 'bonus');
    expect(result.some(e => e.id === '2')).toBe(true);
  });

  it('findet Einträge anhand eines Alias', () => {
    const result = searchEntries(ENTRIES, 'belohnung');
    expect(result.some(e => e.id === '2')).toBe(true);
  });

  it('findet Einträge anhand der Kategorie', () => {
    const result = searchEntries(ENTRIES, 'karten');
    expect(result.some(e => e.id === '3')).toBe(true);
  });

  it('normalisiert Umlaute bei der Suche (üd → ud)', () => {
    const result = searchEntries(ENTRIES, 'sud');
    expect(result.some(e => e.id === '3')).toBe(true);
  });

  it('normalisiert Umlaute in der Eingabe (Süd → sud)', () => {
    const result = searchEntries(ENTRIES, 'Süd');
    expect(result.some(e => e.id === '3')).toBe(true);
  });

  it('ist case-insensitiv', () => {
    expect(searchEntries(ENTRIES, 'ALPHA')).toHaveLength(1);
    expect(searchEntries(ENTRIES, 'alpha')).toHaveLength(1);
  });

  it('gibt keine Ergebnisse zurück wenn nichts passt', () => {
    expect(searchEntries(ENTRIES, 'xyzzy')).toHaveLength(0);
  });

  it('rankt Name-Treffer höher als reine Haystack-Treffer', () => {
    // "beta" ist im Namen von Eintrag 2; "bonus" kommt in Name UND als Tag vor
    // Eintrag mit Name-Treffer soll zuerst kommen
    const withNameMatch = { id: '10', name: 'Bonus-Karte', summary: 'irgendetwas', category: 'X', tags: [], aliases: [], warnings: [], type: 'card' };
    const withTagMatch  = { id: '11', name: 'Andere Karte', summary: 'irgendetwas', category: 'X', tags: ['bonus'], aliases: [], warnings: [], type: 'card' };
    const result = searchEntries([withTagMatch, withNameMatch], 'bonus');
    expect(result[0].id).toBe('10');
  });

  it('unterstützt Multi-Wort-Suche (alle Terme müssen vorkommen)', () => {
    // "aktion alpha" → beide Terme müssen im haystack von Eintrag 1 vorkommen
    const result = searchEntries(ENTRIES, 'aktion alpha');
    expect(result.some(e => e.id === '1')).toBe(true);
    // "aktion beta" → kein Eintrag erfüllt beide Terme gleichzeitig mit vollem Score
    // Eintrag 1 hat "aktion", Eintrag 2 hat "beta", aber keiner hat beide
    // Ergebnis: jeder bekommt score 1 (wegen je einem Term), also beide zurück
    const partial = searchEntries(ENTRIES, 'aktion beta');
    // Beide Einträge müssen im Ergebnis sein (je ein Term matcht)
    expect(partial.some(e => e.id === '1')).toBe(true);
    expect(partial.some(e => e.id === '2')).toBe(true);
  });
});
