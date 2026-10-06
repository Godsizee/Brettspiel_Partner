<script>
  import { onMount, tick } from 'svelte';
  import { currentRoute, navigate, setTransitionHook } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { gamesCatalog, isAdmin } from '$lib/stores/app.js';
  import { SCREENS, LEGACY, screenKey } from './screens.js';
  import { guardRoute } from './routeGuards.js';
  import { ui } from './ui.svelte.js';
  import AppNav from './AppNav.svelte';
  import LiveMatchBar from './LiveMatchBar.svelte';
  import ToastRegion from './ToastRegion.svelte';
  import DialogHost from './DialogHost.svelte';
  import SyncSheet from './SyncSheet.svelte';
  import SyncChip from './SyncChip.svelte';
  import StartPlayerSheet from '$lib/screens/game/StartPlayerSheet.svelte';
  import AuthSheet from '$lib/screens/profile/AuthSheet.svelte';
  import Onboarding from '$lib/components/Onboarding.svelte';             // R16: → OnboardingScreen

  /** @type {Record<string, any>} */
  const loaded = $state({});
  async function ensureScreen(/** @type {string} */ key) {
    if (!loaded[key]) loaded[key] = (await SCREENS[key]()).default;
    return loaded[key];
  }

  let routeName = $derived($currentRoute?.name ?? 'home');
  let key = $derived(screenKey(routeName));
  let isWiki = $derived(key === 'wiki');
  // Neu montieren nur bei echtem Ortswechsel, nicht bei Query-Änderungen (Wiki-Suche).
  let mountKey = $derived(isWiki ? 'wiki' : routeName + JSON.stringify($currentRoute?.params ?? {}));

  let allowed = $state(true);
  $effect(() => { $gamesCatalog; $isAdmin; allowed = guardRoute($currentRoute); });
  $effect(() => { ensureScreen(key); });

  // Nach Ortswechsel: nach oben, Fokus auf den Seitentitel (Wiki macht das selbst).
  $effect(() => {
    mountKey;
    if (isWiki) return;
    tick().then(() => {
      window.scrollTo(0, 0);
      /** @type {HTMLElement | null} */ (document.querySelector('[data-screen-title]'))?.focus({ preventScroll: true });
    });
  });

  onMount(() => {
    setTransitionHook(async (apply, next, prev) => {
      const same = prev && next && prev.name === next.name && JSON.stringify(prev.params) === JSON.stringify(next.params);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (same || reduce || !document.startViewTransition) { apply(); return; }
      try { await ensureScreen(screenKey(next?.name ?? 'home')); } catch { /* Chunk offline nicht ladbar → ohne Übergang */ }
      const vt = document.startViewTransition(async () => { apply(); await tick(); });
      // Verdrängt eine schnelle Folgenavigation (push, dann replace) den Übergang, lehnen diese Promises
      // ab — kein Fehler, der Seitenwechsel selbst läuft durch.
      vt.ready.catch(() => {});
      vt.finished.catch(() => {});
      vt.updateCallbackDone.catch(() => {});
    });
    // Alle Screen-Chunks im Leerlauf vorladen: offline sofort da, Übergänge ohne Leerbild.
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
    idle(() => Object.keys(SCREENS).forEach((k) => ensureScreen(k).catch(() => {})));
    return () => setTransitionHook((apply) => apply());
  });
</script>

<button type="button" class="skip-link" onclick={() => document.getElementById('main')?.focus()}>Zum Inhalt springen</button>
<AppNav />
<main id="main" tabindex="-1" class="shell-main">
  {#if allowed && loaded[key]}
    {@const Screen = loaded[key]}
    {#if isWiki}
      <Screen />
    {:else}
      {#key mountKey}
        <div class={LEGACY.has(key) ? 'legacy-screen' : 'contents'}>
          {#if LEGACY.has(key)}<div class="legacy-sync"><SyncChip /></div>{/if}
          <Screen onopenStartPlayer={() => (ui.startPlayerOpen = true)} onclose={() => navigate(appHash.home())} />
        </div>
      {/key}
    {/if}
  {:else}
    <div class="h-[60dvh]" aria-busy="true"></div>
  {/if}
</main>
<LiveMatchBar />
<ToastRegion />
<DialogHost />
<SyncSheet bind:open={ui.syncOpen} />
<StartPlayerSheet bind:open={ui.startPlayerOpen} />
<AuthSheet bind:open={ui.authOpen} />
{#if ui.onboardingOpen}
  <Onboarding onComplete={(opts) => { ui.onboardingOpen = false; if (opts?.wantsAuth) ui.authOpen = true; }} />
{/if}

<style>
  .skip-link { position: fixed; left: 12px; top: -60px; z-index: 100; padding: 10px 14px; border-radius: var(--r-md);
    background: var(--accent); color: var(--on-accent); font-weight: 600; }
  .skip-link:focus { top: 12px; }
  .shell-main { min-height: 100dvh; padding-bottom: calc(var(--nav-space) + 16px); outline: none; }
  @media (min-width: 1024px) { .shell-main { padding-left: 15rem; padding-bottom: 32px; } }
  /* Übergang: alte Komponenten erwarteten den Innenabstand von .app-main */
  .legacy-screen { max-width: 720px; margin: 0 auto; padding: 12px 16px; position: relative; }
  .legacy-sync { position: absolute; top: 8px; right: 12px; z-index: 5; }
  @media (min-width: 768px) { .legacy-screen { max-width: 860px; padding: 24px; } }
  @media (min-width: 1024px) { .legacy-screen { max-width: 1080px; padding: 32px; } }
</style>
