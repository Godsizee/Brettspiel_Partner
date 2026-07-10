import { describe, it, expect, beforeAll } from 'vitest';
import { parseRoute, registerRoutes } from '$lib/router/router.js';
import { wikiHash, parentHash, ROUTES } from './wikiRoutes.js';

beforeAll(() => {
  registerRoutes(ROUTES);
});

describe('wikiHash', () => {
  it('baut alle Routen-Hashes', () => {
    expect(wikiHash.overview()).toBe('#/wiki');
    expect(wikiHash.game('on-mars')).toBe('#/wiki/on-mars');
    expect(wikiHash.module('voidfall', 'fokusse')).toBe('#/wiki/voidfall/fokusse');
    expect(wikiHash.entry('voidfall', 'fokusse', 'fokus-01')).toBe('#/wiki/voidfall/fokusse/fokus-01');
    expect(wikiHash.search('on-mars', { q: 'gebäude' })).toBe('#/wiki/on-mars/search?q=geb%C3%A4ude');
    expect(wikiHash.search('on-mars')).toBe('#/wiki/on-mars/search');
  });

  it('kodiert Filter der Suche in die URL (P4.1)', () => {
    const hash = wikiHash.search('on-mars', { q: 'rot', category: 'Gebäude', timing: 'Sofort' });
    const route = parseRoute(hash);
    expect(route?.name).toBe('wiki-search');
    expect(route?.query).toEqual({ q: 'rot', category: 'Gebäude', timing: 'Sofort' });
    // Leere Filter werden weggelassen
    expect(wikiHash.search('on-mars', { q: 'rot', category: null })).toBe('#/wiki/on-mars/search?q=rot');
  });

  it('encodiert Sonderzeichen in Segmenten (Roundtrip)', () => {
    const hash = wikiHash.entry('voidfall', 'gefallene_haeuser', 'haus/α β');
    const route = parseRoute(hash);
    expect(route?.params.entry).toBe('haus/α β');
    expect(route?.params.module).toBe('gefallene_haeuser');
  });
});

describe('parentHash', () => {
  it('liefert je Ebene die Elternroute', () => {
    expect(parentHash(parseRoute('#/wiki/voidfall/fokusse/fokus-01'))).toBe('#/wiki/voidfall/fokusse');
    expect(parentHash(parseRoute('#/wiki/voidfall/fokusse'))).toBe('#/wiki/voidfall');
    expect(parentHash(parseRoute('#/wiki/on-mars/search?q=x'))).toBe('#/wiki/on-mars');
    expect(parentHash(parseRoute('#/wiki/on-mars'))).toBe('#/wiki');
    expect(parentHash(parseRoute('#/wiki'))).toBeNull();
    expect(parentHash(null)).toBeNull();
  });
});
