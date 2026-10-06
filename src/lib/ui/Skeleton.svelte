<script>
  /** @type {{ class?: any }} */
  let { class: extra = '' } = $props();
</script>
<div class={['animate-pulse rounded-md bg-surface-2', extra]} aria-hidden="true"></div>
