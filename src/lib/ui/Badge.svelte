<script>
  /** @type {{ tone?: 'accent'|'gold'|'neutral'|'warning'|'danger'|'success', children: import('svelte').Snippet }} */
  let { tone = 'accent', children } = $props();
  const TONES = { accent: 'bg-accent-soft text-accent-soft-fg', gold: 'bg-gold-soft text-gold', neutral: 'bg-surface-2 text-fg-2 border border-line',
    warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success' };
</script>
<span class={['inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap', TONES[tone]]}>{@render children()}</span>
