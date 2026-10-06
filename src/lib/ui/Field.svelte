<script>
  /**
   * @type {{ label: string, value?: string, type?: string, placeholder?: string, error?: string, hint?: string,
   *   hideLabel?: boolean, autocomplete?: any, leading?: import('svelte').Snippet, [key: string]: any }}
   */
  let { label, value = $bindable(''), type = 'text', placeholder = '', error = '', hint = '', hideLabel = false,
    autocomplete = undefined, leading, ...rest } = $props();
  const uid = $props.id();
</script>

<div class="flex flex-col gap-1.5">
  <label for="{uid}-i" class={['text-sm font-semibold', hideLabel && 'sr-only']}>{label}</label>
  <div class={['flex h-11 items-center gap-2 rounded-md border bg-surface-2 px-3 focus-within:border-accent', error ? 'border-danger' : 'border-field-line']}>
    {@render leading?.()}
    <input id="{uid}-i" {type} bind:value {placeholder} {autocomplete} aria-invalid={error ? 'true' : undefined}
      aria-describedby={error || hint ? `${uid}-h` : undefined} class="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-2" {...rest} />
  </div>
  {#if error}<p id="{uid}-h" class="text-sm text-danger">{error}</p>{:else if hint}<p id="{uid}-h" class="text-sm text-fg-2">{hint}</p>{/if}
</div>
