<script>
  import Star from '@lucide/svelte/icons/star';
  import Dice5 from '@lucide/svelte/icons/dice-5';
  import {
    Button, IconButton, Sheet, Switch, Segmented, Stepper, Card, ListRow, Field, Badge, EmptyState, Skeleton, PlayerDot,
  } from '$lib/ui/index.js';

  let sheetOpen = $state(false);
  let switchOn = $state(true);
  let segValue = $state('a');
  let chipValue = $state('alle');
  let stepValue = $state(3);
  let fieldValue = $state('');

  const SEG_OPTIONS = [
    { value: 'a', label: 'Alle' },
    { value: 'b', label: 'Meine Spiele' },
    { value: 'c', label: 'Wunschliste' },
  ];
  const CHIP_OPTIONS = [
    { value: 'alle', label: 'Alle', count: 22 },
    { value: 'experte', label: 'Expertenspiel', count: 9 },
    { value: 'familie', label: 'Familienspiel', count: 13 },
  ];
</script>

{#snippet gallery()}
  <section class="flex flex-col gap-8 p-6">
    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Button</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="primary">Primär</Button>
        <Button variant="secondary">Sekundär</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Löschen</Button>
        <Button variant="danger-ghost">Entfernen</Button>
        <Button variant="primary" loading>Speichert …</Button>
        <Button variant="primary" disabled>Deaktiviert</Button>
        <Button variant="primary" size="lg">Groß</Button>
      </div>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">IconButton</h2>
      <div class="flex items-center gap-3">
        <IconButton label="Favorit" variant="plain"><Star class="size-5" aria-hidden="true" /></IconButton>
        <IconButton label="Favorit" variant="outline"><Star class="size-5" aria-hidden="true" /></IconButton>
        <IconButton label="Favorit" variant="overlay"><Star class="size-5" aria-hidden="true" /></IconButton>
        <IconButton label="Favorit (aktiv)" variant="plain" pressed={true}><Star class="size-5" aria-hidden="true" /></IconButton>
      </div>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Sheet</h2>
      <Button variant="secondary" onclick={() => (sheetOpen = true)}>Sheet öffnen</Button>
      <Sheet bind:open={sheetOpen} title="Beispiel-Sheet" description="Native dialog mit Fokusfalle und Esc.">
        <p class="text-sm text-fg-2">Inhalt des Sheets.</p>
        {#snippet footer()}
          <Button variant="secondary" onclick={() => (sheetOpen = false)}>Abbrechen</Button>
          <Button variant="primary" onclick={() => (sheetOpen = false)}>Speichern</Button>
        {/snippet}
      </Sheet>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Switch</h2>
      <Card padded class="max-w-sm">
        <Switch bind:checked={switchOn} label="Benachrichtigungen" description="Erinnerung bei laufendem Timer" />
      </Card>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Segmented</h2>
      <div class="flex flex-col gap-3 max-w-md">
        <Segmented bind:value={segValue} options={SEG_OPTIONS} label="Katalog-Filter" />
        <Segmented bind:value={chipValue} options={CHIP_OPTIONS} label="Kategorie-Filter" variant="chips" />
      </div>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Stepper</h2>
      <Stepper bind:value={stepValue} min={0} max={10} label="Spieleranzahl" />
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Card / ListRow</h2>
      <Card class="max-w-md">
        <ListRow title="On Mars" subtitle="Eagle-Gryphon Games" href="#">
          {#snippet leading()}<Dice5 class="size-5" aria-hidden="true" />{/snippet}
        </ListRow>
        <ListRow title="Partie löschen" tone="danger" onclick={() => {}} />
      </Card>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Field</h2>
      <Field bind:value={fieldValue} label="Spielername" placeholder="z. B. Anna" hint="Erscheint auf dem Wertungsbogen" class="max-w-sm" />
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Badge</h2>
      <div class="flex flex-wrap gap-2">
        <Badge tone="accent">Akzent</Badge>
        <Badge tone="gold">Gold</Badge>
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="warning">Warnung</Badge>
        <Badge tone="danger">Fehler</Badge>
        <Badge tone="success">Erfolg</Badge>
      </div>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">PlayerDot</h2>
      <div class="flex items-center gap-4">
        <PlayerDot color="hsl(195, 85%, 50%)" />
        <PlayerDot color="hsl(270, 75%, 60%)" name="Anna" size="md" />
        <PlayerDot color={null} name="Ben" size="md" />
      </div>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">EmptyState</h2>
      <EmptyState title="Noch keine Partien" text="Starte eine Partie, um sie hier zu sehen." icon={Dice5}>
        {#snippet action()}<Button variant="primary">Spiel wählen</Button>{/snippet}
      </EmptyState>
    </div>

    <div>
      <h2 class="font-display text-h2 font-semibold mb-3">Skeleton</h2>
      <div class="flex flex-col gap-2 max-w-sm">
        <Skeleton class="h-5 w-3/4" />
        <Skeleton class="h-5 w-1/2" />
        <Skeleton class="h-24 w-full" />
      </div>
    </div>
  </section>
{/snippet}

<div class="min-h-dvh bg-canvas">
  <div data-theme="light" class="bg-canvas text-fg">
    <p class="px-6 pt-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Hell</p>
    {@render gallery()}
  </div>
  <div data-theme="dark" class="bg-canvas text-fg">
    <p class="px-6 pt-4 text-xs font-semibold uppercase tracking-wide text-fg-3">Dunkel</p>
    {@render gallery()}
  </div>
</div>
