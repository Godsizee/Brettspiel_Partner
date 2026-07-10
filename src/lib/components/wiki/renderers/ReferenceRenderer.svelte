<script>
  // @ts-check
  import WikiEntryBrowser from '$lib/components/wiki/WikiEntryBrowser.svelte';

  /** @type {{ module: any, entryHref?: (e: any) => string }} */
  let { module, entryHref = () => '#/wiki' } = $props();

  let entries = $derived(
    Array.isArray(module?.data)
      ? module.data
      : Array.isArray(module?.data?.entries)
        ? module.data.entries
        : []
  );
</script>

<div class="flex flex-col gap-5 w-full">
  <WikiEntryBrowser {entries} {entryHref} />
</div>
