<script>
  import { isAuthenticated } from '$lib/stores/app.js';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import UserProfile from '$lib/components/UserProfile.svelte';
</script>
{#if $isAuthenticated}<UserProfile />{:else}<AuthModal inline={true} />{/if}
