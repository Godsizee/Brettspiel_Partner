<script>
  /** @type {{ padded?: boolean, class?: any, children: import('svelte').Snippet, [key: string]: any }} */
  let { padded = false, class: extra = '', children, ...rest } = $props();
</script>
<div class={['overflow-hidden rounded-md border border-line bg-surface shadow-1', padded && 'p-4', extra]} {...rest}>{@render children()}</div>
