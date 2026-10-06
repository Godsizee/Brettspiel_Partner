<script>
  // @ts-check
  import Info from '@lucide/svelte/icons/info';
  import IconButton from '$lib/ui/IconButton.svelte';
  import { categoryIconUrl } from '$lib/scoring/categoryIcon.js';
  import { makeSvgIcon } from '$lib/scoring/categoryGlyphs.js';

  /**
   * @type {{ cat: any, value: number, badge?: string, whiteIcon?: boolean, expanded?: boolean,
   *   oninput: (v: number) => void, oncommit: (v: number, before: number) => void,
   *   onhelp?: () => void, ontoggle?: () => void, comparison?: import('svelte').Snippet }}
   */
  let { cat, value, badge = '', whiteIcon = false, expanded = false, oninput, oncommit, onhelp, ontoggle, comparison } = $props();
  const uid = $props.id();
  let before = 0;
  let iconUrl = $derived(categoryIconUrl(cat.icon));
  let sub = $derived([
    cat.type === 'step' ? `Skala ${(cat.steps ?? []).map((/** @type {any} */ s) => Number(s) || 0).join('/')}` : '',
    cat.type === 'multiplier' ? `je ${cat.multiplier || 1} SP` : '',
    cat.allowNegative ? 'auch negativ möglich' : '',
    badge,
  ].filter(Boolean).join(' · '));
  const parse = (/** @type {string} */ raw) => { const n = parseFloat(raw); return Number.isNaN(n) ? 0 : n; };
</script>

<div class="border-t border-line first:border-t-0">
  <div class="flex min-h-16 items-center gap-3 py-2 pl-3 pr-2">
    <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}
      aria-controls="{uid}-cmp" onclick={ontoggle}>
      <span class={['grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px]', whiteIcon ? 'bg-white' : 'bg-surface-2']} aria-hidden="true">
        {#if iconUrl}<img src={iconUrl} alt="" width="30" height="30" loading="lazy" class="size-[30px] object-contain" />
        {:else}{@html makeSvgIcon(cat.svgIcon || 'star', cat.iconColor)}{/if}
      </span>
      <span class="min-w-0 leading-tight">
        <span id="{uid}-l" class="block font-medium">{cat.label}</span>
        {#if sub}<small class="mt-0.5 block text-[0.8rem] text-fg-2">{sub}</small>{/if}
      </span>
    </button>
    {#if cat.description}
      <IconButton label="Regel: {cat.label}" onclick={onhelp}><Info class="size-5 text-fg-3" aria-hidden="true" /></IconButton>
    {/if}
    <input class={['tabular h-12 w-[4.5rem] shrink-0 rounded-sm border border-field-line bg-surface-2 px-3 text-right text-lg font-semibold',
        'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30', value === 0 && 'font-medium text-fg-2']}
      type="number" inputmode={cat.allowNegative ? undefined : 'numeric'} pattern={cat.allowNegative ? undefined : '[0-9]*'}
      aria-labelledby="{uid}-l" {value}
      onfocus={(e) => { before = parse(e.currentTarget.value); e.currentTarget.select(); }}
      oninput={(e) => { const raw = e.currentTarget.value; if (raw === '' || raw === '-') return; oninput(parse(raw)); }}
      onchange={(e) => { if (Number.isNaN(parseFloat(e.currentTarget.value))) e.currentTarget.value = '0'; oncommit(parse(e.currentTarget.value), before); }}
      onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  </div>
  {#if expanded}<div id="{uid}-cmp" class="px-3 pb-3">{@render comparison?.()}</div>{/if}
</div>
