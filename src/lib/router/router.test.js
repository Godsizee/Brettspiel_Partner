import { describe, it, expect, beforeAll } from 'vitest';
import { parseRoute, registerRoutes } from './router.js';
import { ROUTES } from '$lib/components/wiki/utils/wikiRoutes.js';

beforeAll(() => {
  registerRoutes(ROUTES);
});

describe('parseRoute', () => {
  it('matcht die Wiki-Übersicht', () => {
    expect(parseRoute('#/wiki')).toMatchObject({ name: 'wiki-overview', params: {}, query: {} });
  });

  it('matcht die Spiel-Landing mit Param', () => {
    expect(parseRoute('#/wiki/on-mars')).toMatchObject({
      name: 'wiki-game',
      params: { game: 'on-mars' }
    });
  });

  it('matcht Modul- und Eintragsrouten', () => {
    expect(parseRoute('#/wiki/voidfall/fokusse')).toMatchObject({
      name: 'wiki-module',
      params: { game: 'voidfall', module: 'fokusse' }
    });
    expect(parseRoute('#/wiki/voidfall/fokusse/fokus-01')).toMatchObject({
      name: 'wiki-entry',
      params: { game: 'voidfall', module: 'fokusse', entry: 'fokus-01' }
    });
  });

  it('lässt das Literal "search" vor der Modul-Route gewinnen', () => {
    expect(parseRoute('#/wiki/on-mars/search')).toMatchObject({
      name: 'wiki-search',
      params: { game: 'on-mars' }
    });
  });

  it('decodiert Umlaute in Params und Query', () => {
    const route = parseRoute('#/wiki/on-mars/search?q=geb%C3%A4ude');
    expect(route?.query.q).toBe('gebäude');

    const entry = parseRoute('#/wiki/voidfall/technologien/pr%C3%A4zisions-labor');
    expect(entry?.params.entry).toBe('präzisions-labor');
  });

  it('liefert null für fremde oder kaputte Hashes', () => {
    expect(parseRoute('')).toBeNull();
    expect(parseRoute('#impressum')).toBeNull();
    expect(parseRoute('#/unbekannt')).toBeNull();
    expect(parseRoute('#/wiki/a/b/c/d/e')).toBeNull();
  });

  it('normalisiert doppelte Slashes', () => {
    expect(parseRoute('#/wiki//on-mars')).toMatchObject({ name: 'wiki-game', params: { game: 'on-mars' } });
  });
});
