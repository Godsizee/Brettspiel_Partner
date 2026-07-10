import { describe, it, expect, beforeEach, vi } from 'vitest';

const idbStore = new Map();
vi.mock('$lib/services/DbService.js', () => ({
  db: {
    get: vi.fn(async (key) => idbStore.get(key) ?? null),
    set: vi.fn(async (key, value) => { idbStore.set(key, value); })
  }
}));

import { addRecentEntry, getRecentEntries } from './wikiRecents.js';

beforeEach(() => {
  idbStore.clear();
});

describe('wikiRecents', () => {
  it('fügt einen Eintrag hinzu und holt ihn ab', async () => {
    await addRecentEntry('voidfall', 'fokusse', 'alpha', 'Alpha Fokus');
    const recents = await getRecentEntries('voidfall');
    expect(recents).toHaveLength(1);
    expect(recents[0]).toEqual({
      slug: 'voidfall',
      moduleId: 'fokusse',
      entryId: 'alpha',
      name: 'Alpha Fokus',
      ts: expect.any(Number)
    });
  });

  it('verhindert doppelte Einträge und sortiert nach Aktualität', async () => {
    await addRecentEntry('voidfall', 'fokusse', 'alpha', 'Alpha Fokus');
    await addRecentEntry('voidfall', 'fokusse', 'beta', 'Beta Fokus');
    await addRecentEntry('voidfall', 'fokusse', 'alpha', 'Alpha Fokus'); // Erneut besucht

    const recents = await getRecentEntries('voidfall');
    expect(recents).toHaveLength(2);
    expect(recents[0].entryId).toBe('alpha'); // Alpha ist jetzt wieder der neueste
    expect(recents[1].entryId).toBe('beta');
  });

  it('begrenzt die Anzahl auf maximal 8 Einträge', async () => {
    for (let i = 1; i <= 10; i++) {
      await addRecentEntry('voidfall', 'fokusse', `entry-${i}`, `Eintrag ${i}`);
    }
    const recents = await getRecentEntries('voidfall');
    expect(recents).toHaveLength(8);
    expect(recents[0].entryId).toBe('entry-10'); // Der allerneueste
    expect(recents[7].entryId).toBe('entry-3');  // Der älteste verbleibende
  });
});
