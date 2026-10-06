<script>
  import Dices from '@lucide/svelte/icons/dices';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import History from '@lucide/svelte/icons/history';
  import UserRound from '@lucide/svelte/icons/user-round';
  import { currentRoute } from '$lib/router/router.js';
  import { wikiHash } from '$lib/components/wiki/utils/wikiRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { currentGame } from '$lib/stores/app.js';
  import { FOCUS_ROUTES } from './screens.js';
  import SyncChip from './SyncChip.svelte';

  let name = $derived($currentRoute?.name ?? 'home');
  // Wiki-Tab öffnet das Wiki des aktuellen Spiels, solange man in dessen Kontext ist (altes Verhalten).
  let wikiHref = $derived($currentGame && ['game', 'match-players', 'match-live', 'match-score'].includes(name)
    ? wikiHash.game(toSlug($currentGame)) : wikiHash.overview());

  let tabs = $derived([
    { label: 'Spielen', href: '#/', icon: Dices, on: ['home', 'game', 'match-players', 'match-live', 'match-score', 'custom-game-new'].includes(name) },
    { label: 'Wiki', href: wikiHref, icon: BookOpen, on: name.startsWith('wiki') },
    { label: 'Chronik', href: '#/chronik', icon: History, on: name === 'history' || name === 'stats' },
    { label: 'Profil', href: '#/profil', icon: UserRound, on: ['profile', 'settings', 'legal', 'admin-review'].includes(name) },
  ]);
</script>

<nav class="appnav" class:appnav--hidden={FOCUS_ROUTES.has(name)} aria-label="Hauptnavigation">
  <a href="#/" class="appnav__brand font-display">Boardgame Companion</a>
  <ul class="appnav__list">
    {#each tabs as t (t.label)}
      <li>
        <a href={t.href} class="appnav__item" aria-current={t.on ? 'page' : undefined}>
          <span class="appnav__pill"><t.icon class="size-[22px]" aria-hidden="true" /></span>
          <span>{t.label}</span>
        </a>
      </li>
    {/each}
  </ul>
  <div class="appnav__foot">
    <SyncChip />
    <a href="#/profil/rechtliches" class="text-sm text-fg-2 hover:text-fg">Impressum & Datenschutz</a>
  </div>
</nav>

<style>
  .appnav { position: fixed; z-index: 40; left: 0; right: 0; bottom: 0; background: var(--surface); border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom); }
  .appnav__brand, .appnav__foot { display: none; }
  .appnav__list { display: grid; grid-template-columns: repeat(4, 1fr); height: var(--nav-h); list-style: none; margin: 0; padding: 0; }
  .appnav__item { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    font-size: 0.72rem; font-weight: 600; color: var(--text-2); text-decoration: none; }
  .appnav__pill { width: 56px; height: 30px; border-radius: 999px; display: grid; place-items: center; transition: background var(--dur-1); }
  .appnav__item[aria-current='page'] { color: var(--text); }
  .appnav__item[aria-current='page'] .appnav__pill { background: var(--accent-soft); color: var(--accent-soft-fg); }
  @media (max-width: 1023.98px) { .appnav--hidden { display: none; } }
  @media (min-width: 1024px) {
    .appnav { top: 0; right: auto; width: 15rem; border-top: 0; border-right: 1px solid var(--line); padding: 20px 12px;
      display: flex; flex-direction: column; gap: 20px; }
    .appnav__brand { display: block; font-size: 1.25rem; font-weight: 600; color: var(--text); text-decoration: none; padding: 0 12px; }
    .appnav__list { display: flex; flex-direction: column; gap: 4px; height: auto; }
    .appnav__item { flex-direction: row; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 8px; border-radius: var(--r-md);
      font-size: 0.95rem; }
    .appnav__item:hover { background: var(--surface-2); }
    .appnav__pill { width: 36px; height: 32px; }
    .appnav__foot { display: flex; flex-direction: column; gap: 12px; margin-top: auto; padding: 0 12px; }
  }
</style>
