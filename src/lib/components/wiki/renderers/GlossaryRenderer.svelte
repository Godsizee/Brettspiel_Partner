<script>
  // @ts-check
  import ReferenceRenderer from '$lib/components/wiki/renderers/ReferenceRenderer.svelte';
  /** @type {{ module: any, entryHref?: (e: any) => string }} */
  let { module, entryHref = () => '#/wiki' } = $props();
</script>

<ReferenceRenderer {module} {entryHref} />
