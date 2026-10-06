<script>
  // @ts-check
  import Sheet from '$lib/ui/Sheet.svelte';
  import SignInPanel from './SignInPanel.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();
</script>

<Sheet bind:open title="Konto" description="Anmelden, um Partien in der Cloud zu sichern" size="md">
  {#if open}
    <SignInPanel oncomplete={() => (open = false)} oncancel={() => (open = false)} />
  {/if}
</Sheet>
