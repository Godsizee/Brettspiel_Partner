<script>
  import { onMount } from 'svelte';
  import AppShell from '$lib/shell/AppShell.svelte';
  import { bootstrapApp } from '$lib/shell/bootstrap.js';

  onMount(() => {
    let cleanup;
    bootstrapApp().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  });
</script>

<AppShell />
