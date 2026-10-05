<script>
  import { toasts } from '$lib/stores/app.js';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import Info from '@lucide/svelte/icons/info';

  const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info };
  const TONE = { success: 'text-success', error: 'text-danger', warning: 'text-warning', info: 'text-accent' };
  // Emojis aus Alt-Texten entfernen (Plan C7) — zentral statt 100 Aufrufer anzufassen.
  const clean = (/** @type {string} */ m) => m.replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s{2,}/g, ' ').trim();
  let current = $derived($toasts.at(-1));
</script>

<div class="toast-region" aria-live="polite" aria-atomic="true">
  {#if current}
    {@const Icon = ICONS[current.type] ?? Info}
    {#key current.id}
      <div class="toast">
        <Icon class="size-5 shrink-0 {TONE[current.type] ?? 'text-accent'}" aria-hidden="true" />
        <span class="flex-1">{clean(current.message)}</span>
        {#if current.action}
          <button type="button" class="font-bold text-accent" onclick={() => current.action.onClick()}>{current.action.label}</button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .toast-region { position: fixed; z-index: 60; left: 12px; right: 12px; bottom: calc(var(--nav-space) + 12px); display: flex; justify-content: center; pointer-events: none; }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 30rem; width: 100%; padding: 12px 14px;
    border-radius: var(--r-md); background: var(--surface); color: var(--text); border: 1px solid var(--line-strong);
    box-shadow: var(--sh-2); font-size: 0.9375rem; animation: toast-in var(--dur-2) var(--ease-standard); }
  @keyframes toast-in { from { transform: translateY(8px); opacity: 0; } }
  @media (min-width: 1024px) { .toast-region { left: auto; right: 24px; bottom: 24px; justify-content: flex-end; } }
</style>
