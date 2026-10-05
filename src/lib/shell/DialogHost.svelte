<script>
  import { dialogState } from '$lib/stores/app.js';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Field from '$lib/ui/Field.svelte';

  let value = $state('');
  let open = $state(false);
  $effect(() => { open = $dialogState.isOpen; if ($dialogState.isOpen) value = ''; });

  /** Genau einmal auflösen: erst Store schließen, dann resolve (onclose sieht isOpen=false). */
  function finish(result) {
    const resolve = $dialogState.resolve;
    dialogState.update((s) => ({ ...s, isOpen: false }));
    resolve(result);
  }
  function onclose() {
    if ($dialogState.isOpen) finish($dialogState.type === 'confirm' ? false : null);
  }
</script>

<Sheet bind:open title={$dialogState.title} size="sm" {onclose}>
  <p class="text-fg-2">{$dialogState.message}</p>
  {#if $dialogState.type === 'prompt'}
    <form id="dialog-prompt" onsubmit={(e) => { e.preventDefault(); finish(value); }}>
      <Field label={$dialogState.title} hideLabel type={$dialogState.isPassword ? 'password' : 'text'}
        placeholder={$dialogState.placeholder} bind:value />
    </form>
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => finish($dialogState.type === 'confirm' ? false : null)}>Abbrechen</Button>
    {#if $dialogState.type === 'prompt'}
      <Button variant="primary" type="submit" form="dialog-prompt">OK</Button>
    {:else}
      <Button variant="primary" onclick={() => finish(true)}>Bestätigen</Button>
    {/if}
  {/snippet}
</Sheet>
