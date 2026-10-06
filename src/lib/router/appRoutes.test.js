import { describe, it, expect, beforeAll } from 'vitest';
import { registerRoutes, parseRoute } from './router.js';
import { APP_ROUTES, appHash } from './appRoutes.js';

beforeAll(() => registerRoutes(APP_ROUTES));

describe('App-Routen', () => {
  it.each([
    ['#/', 'home'], ['#/spiel/on-mars', 'game'], ['#/partie', 'match-live'], ['#/partie?start=1', 'match-live'],
    ['#/partie/spieler?next=score', 'match-players'], ['#/partie/wertung', 'match-score'], ['#/chronik', 'history'],
    ['#/chronik/statistik', 'stats'], ['#/profil', 'profile'], ['#/profil/einstellungen', 'settings'],
    ['#/profil/rechtliches', 'legal'], ['#/eigenes-spiel', 'custom-game-new'], ['#/admin', 'admin-review'],
    ['#/wiki', 'wiki-overview'], ['#/wiki/on-mars/regeln', 'wiki-module'],
  ])('%s → %s', (hash, name) => expect(parseRoute(hash)?.name).toBe(name));

  it('Slug mit ß übersteht den Hash', () => {
    expect(parseRoute(appHash.game('die-blumenstraße'))?.params.game).toBe('die-blumenstraße');
  });
  it('Query wird gelesen', () => expect(parseRoute(appHash.matchPlayers('score'))?.query.next).toBe('score'));
  it('Sprungmarke ist keine Route (S11)', () => expect(parseRoute('#impressum')).toBeNull());
});
