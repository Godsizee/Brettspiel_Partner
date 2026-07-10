<script>
  import { toasts } from '$lib/stores/app.js';
</script>

{#if $toasts.length > 0}
  <div class="toast-container" aria-live="polite" aria-atomic="false">
    {#each $toasts as toast (toast.id)}
      <div class="toast {toast.type}" role="alert">
        <span class="toast-icon">
          {#if toast.type === 'success'}✅
          {:else if toast.type === 'error'}❌
          {:else if toast.type === 'warning'}⚠️
          {:else}ℹ️{/if}
        </span>
        <span class="toast-message">{toast.message}</span>
        {#if toast.action}
          <button class="toast-action" onclick={() => { toast.action.onClick(); toasts.update(t => t.filter(x => x.id !== toast.id)); }}>
            {toast.action.label}
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Styles sind global in app.css definiert */
  .toast-icon { font-size: 0.9rem; flex-shrink: 0; }
  .toast-message { flex: 1; }
  .toast-action {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .toast-action:hover { background: rgba(255, 255, 255, 0.25); }
</style>
