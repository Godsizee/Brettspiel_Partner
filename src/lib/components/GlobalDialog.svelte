<script>
  import { dialogState } from '$lib/stores/app.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { onMount } from 'svelte';
  import { trapFocus } from '$lib/utils/a11y.js';

  let inputVal = $state('');

  function closeDialog(result) {
    HapticService.lightTap();
    $dialogState.resolve(result);
    $dialogState.isOpen = false;
    inputVal = '';
  }

  function handleOk() {
    if ($dialogState.type === 'confirm') {
      closeDialog(true);
    } else {
      closeDialog(inputVal);
    }
  }

  function handleCancel() {
    if ($dialogState.type === 'confirm') {
      closeDialog(false);
    } else {
      closeDialog(null);
    }
  }
  
  $effect(() => {
    if ($dialogState.isOpen && $dialogState.type === 'prompt') {
      inputVal = ''; // Reset input on open
    }
  });

  function handleKeydown(e) {
    if (!$dialogState.isOpen) return;
    if (e.key === 'Escape') handleCancel(); 
    if (e.key === 'Enter') handleOk(); 
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $dialogState.isOpen}
  <div class="overlay-backdrop active z-[4000]" role="dialog" aria-modal="true" aria-label={$dialogState.title}>
    <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={handleCancel}></button>
    <div class="overlay-card glass-panel animate-scale-up max-w-[400px] w-[calc(100%-32px)] p-6 flex flex-col gap-4 text-center" 
         use:trapFocus>
      <div class="dialog-header">
        <h2 class="dialog-title m-0">{$dialogState.title}</h2>
      </div>
      
      <div class="dialog-body">
        <p class="dialog-message m-0">{$dialogState.message}</p>
        
        {#if $dialogState.type === 'prompt'}
          <div class="w-full mt-4">
            <!-- svelte-ignore a11y_autofocus -->
            <input 
              type={$dialogState.isPassword ? 'password' : 'text'} 
              class="auth-input" 
              placeholder={$dialogState.placeholder}
              bind:value={inputVal}
              autofocus
            />
          </div>
        {/if}
      </div>
      
      <div class="flex gap-3 mt-2">
        <button class="btn btn-secondary flex-1" onclick={handleCancel}>Abbrechen</button>
        <button class="btn btn-primary flex-1" onclick={handleOk}>OK</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-title {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .dialog-message {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
    white-space: pre-line;
  }
</style>
