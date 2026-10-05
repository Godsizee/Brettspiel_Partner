<script>
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { timerState, timerText, currentGame, gamesCatalog } from '$lib/stores/app.js';
  import { currentRoute } from '$lib/router/router.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { safeCssColor } from '$lib/ui/color.js';

  let game = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let onMatch = $derived(($currentRoute?.name ?? '').startsWith('match-'));
  let visible = $derived(!!game && $timerState !== 'stopped' && !onMatch);
  let cover = $derived(game?.cover ? validateGameImageUrl(game.cover) : '');

  // Platz für die Leiste reservieren (Dock, Toasts, Inhalt rechnen mit --livebar-h)
  $effect(() => {
    document.documentElement.style.setProperty('--livebar-h', visible ? '64px' : '0px');
  });
</script>

{#if visible}
  <a href="#/partie" class="livebar" style:--game-accent={safeCssColor(game?.theme?.primary, 'var(--accent)')}
    aria-label="Laufende Partie: {game?.name}, {$timerState === 'running' ? 'läuft' : 'pausiert'}. Öffnen">
    {#if cover}<img src={cover} alt="" width="40" height="40" />{/if}
    <span class="livebar__text"><strong>{game?.name}</strong><span>{$timerState === 'running' ? 'läuft' : 'pausiert'}</span></span>
    <span class="tabular livebar__time" aria-hidden="true">{$timerText}</span>
    <ChevronRight class="size-5" aria-hidden="true" />
  </a>
{/if}

<style>
  .livebar { position: fixed; z-index: 39; left: 8px; right: 8px; bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);
    height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 6px; border-radius: var(--r-md);
    background: var(--text); color: var(--bg); box-shadow: var(--sh-2); text-decoration: none; overflow: hidden; }
  .livebar::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--game-accent); }
  .livebar img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; margin-left: 6px; }
  .livebar__text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; font-size: 0.8rem; }
  .livebar__text strong { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .livebar__time { font-weight: 700; font-size: 1.05rem; }
  @media (min-width: 1024px) { .livebar { left: 12px; right: auto; width: calc(15rem - 24px); bottom: 96px; } }
</style>
