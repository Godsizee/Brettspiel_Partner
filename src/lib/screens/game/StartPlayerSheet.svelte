<script>
  import { untrack, onMount } from 'svelte';
  import Crown from '@lucide/svelte/icons/crown';
  import Dices from '@lucide/svelte/icons/dices';
  import Hand from '@lucide/svelte/icons/hand';
  import X from '@lucide/svelte/icons/x';
  import { DEFAULT_PLAYER_COLORS } from '$lib/stores/app.js';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import Stepper from '$lib/ui/Stepper.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  let playerCount = $state(2);
  /** @type {string[]} */
  let names = $state(['', '']);
  let step = $state('setup'); // 'setup' | 'result'
  let spinning = $state(false);
  let spinningName = $state('');
  let winner = $state('');
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let spinTimer;

  // Mobile device & touch detection
  let isMobileTouch = $state(false);
  let activeTab = $state('list'); // 'list' | 'picker'
  let fullscreenActive = $state(false);

  onMount(() => {
    const checkDevice = () => {
      isMobileTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  });

  // Fingerfarben: dieselben Farben wie die Spielerfarben der App
  const FINGER_COLORS = DEFAULT_PLAYER_COLORS;

  /**
   * @typedef {Object} ActiveTouch
   * @property {number} id - Touch-Identifikator
   * @property {number} x - X-Koordinate
   * @property {number} y - Y-Koordinate
   * @property {string} color - Zugeordnete Farbe
   */
  /** @type {ActiveTouch[]} */
  let activeTouches = $state([]);
  let touchState = $state('waiting'); // 'waiting' | 'stabilizing' | 'countdown' | 'selecting' | 'finished'
  /** @type {number | null} */
  let countdownValue = $state(null);
  /** @type {number | null} */
  let winnerTouchId = $state(null);
  let pickerWinnerName = $state('');

  /** @type {any[]} */
  let particles = $state([]);
  let particleAnimationActive = false;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let stabilityTimer;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let countdownTimer;

  $effect(() => {
    const count = playerCount; // tracked
    names = untrack(() => Array.from({ length: count }, (_, i) => names[i] ?? ''));
  });

  /** @param {number | number[]} ms */
  function vibrate(ms) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        console.warn('Vibration failed', e);
      }
    }
  }

  function resetFingerPicker() {
    clearTimeout(stabilityTimer);
    clearInterval(countdownTimer);
    activeTouches = [];
    touchState = 'waiting';
    countdownValue = null;
    winnerTouchId = null;
    pickerWinnerName = '';
    particles = [];
  }

  function close() {
    open = false;
    clearInterval(spinTimer);
    step = 'setup';
    spinning = false;
    winner = '';
    fullscreenActive = false;
    resetFingerPicker();
  }

  function draw() {
    const validNames = names.map((n, i) => n.trim() || `Spieler ${i + 1}`);
    step = 'result';
    spinning = true;
    winner = '';

    let cycles = 0;
    const maxCycles = 20 + Math.floor(Math.random() * 15);
    clearInterval(spinTimer);
    spinTimer = setInterval(() => {
      spinningName = validNames[Math.floor(Math.random() * validNames.length)];
      cycles++;
      if (cycles >= maxCycles) {
        clearInterval(spinTimer);
        winner = validNames[Math.floor(Math.random() * validNames.length)];
        spinningName = winner;
        spinning = false;
      }
    }, 80);
  }

  // Touch handlers
  /** @param {TouchEvent} e */
  function handleTouchStart(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (activeTouches.some(t => t.id === touch.identifier)) continue;

      const unusedColors = FINGER_COLORS.filter(c => !activeTouches.some(t => t.color === c));
      const color = unusedColors.length > 0
        ? unusedColors[Math.floor(Math.random() * unusedColors.length)]
        : FINGER_COLORS[Math.floor(Math.random() * FINGER_COLORS.length)];

      activeTouches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        color
      });
    }
    activeTouches = [...activeTouches];
    vibrate(15);
    checkCountdownTrigger();
  }

  /** @param {TouchEvent} e */
  function handleTouchMove(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const match = activeTouches.find(t => t.id === touch.identifier);
      if (match) {
        match.x = touch.clientX;
        match.y = touch.clientY;
      }
    }
    activeTouches = [...activeTouches];
  }

  /** @param {TouchEvent} e */
  function handleTouchEnd(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      activeTouches = activeTouches.filter(t => t.id !== touch.identifier);
    }
    activeTouches = [...activeTouches];
    checkCountdownTrigger();
  }

  /**
   * Touch-Listener nicht-passiv registrieren (Svelte registriert ontouch* passiv,
   * dann wirkt preventDefault nicht und die Seite scrollt/zoomt unter dem Finger).
   * @param {HTMLElement} node
   */
  function touchSurface(node) {
    const opts = { passive: false };
    node.addEventListener('touchstart', handleTouchStart, opts);
    node.addEventListener('touchmove', handleTouchMove, opts);
    node.addEventListener('touchend', handleTouchEnd, opts);
    node.addEventListener('touchcancel', handleTouchEnd, opts);
    return {
      destroy() {
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        node.removeEventListener('touchend', handleTouchEnd);
        node.removeEventListener('touchcancel', handleTouchEnd);
      },
    };
  }

  function checkCountdownTrigger() {
    clearTimeout(stabilityTimer);
    clearInterval(countdownTimer);

    if (touchState === 'finished' || touchState === 'selecting') return;

    if (activeTouches.length < 2) {
      touchState = 'waiting';
      countdownValue = null;
      return;
    }

    touchState = 'stabilizing';
    countdownValue = null;

    stabilityTimer = setTimeout(() => {
      startCountdown();
    }, 1500);
  }

  function startCountdown() {
    touchState = 'countdown';
    countdownValue = 3;
    vibrate(30);

    countdownTimer = setInterval(() => {
      if (countdownValue !== null && countdownValue > 1) {
        countdownValue--;
        vibrate(30);
      } else {
        clearInterval(countdownTimer);
        countdownValue = 0;
        selectWinner();
      }
    }, 1000);
  }

  // Draw selection
  function selectWinner() {
    touchState = 'selecting';
    vibrate(100);

    let flashInterval = setInterval(() => {
      vibrate(15);
    }, 100);

    setTimeout(() => {
      clearInterval(flashInterval);

      if (activeTouches.length > 0) {
        const winnerIdx = Math.floor(Math.random() * activeTouches.length);
        const winnerTouch = activeTouches[winnerIdx];
        winnerTouchId = winnerTouch.id;

        const validNames = names.map((n, i) => n.trim() || `Spieler ${i + 1}`);
        pickerWinnerName = validNames[winnerIdx] || `Spieler ${winnerIdx + 1}`;

        touchState = 'finished';
        vibrate([150, 50, 150]);

        // Spawn particles
        activeTouches.forEach((t) => {
          if (t.id !== winnerTouchId) {
            spawnParticles(t.x, t.y, t.color, 25);
          } else {
            spawnParticles(t.x, t.y, 'var(--gold)', 40);
          }
        });
      } else {
        resetFingerPicker();
      }
    }, 1200);
  }

  /**
   * @param {number} x @param {number} y @param {string} color @param {number} [count]
   */
  function spawnParticles(x, y, color, count = 25) {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      const size = 3 + Math.random() * 5;
      temp.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size,
        opacity: 1
      });
    }
    particles = [...particles, ...temp];
  }

  function updateParticles() {
    if (particles.length === 0) {
      particleAnimationActive = false;
      return;
    }

    particles = particles.map(p => {
      return {
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy + 0.15,
        opacity: p.opacity - 0.025,
        size: p.size * 0.96
      };
    }).filter(p => p.opacity > 0);

    if (particles.length > 0) {
      requestAnimationFrame(updateParticles);
    } else {
      particleAnimationActive = false;
    }
  }

  $effect(() => {
    if (particles.length > 0 && !particleAnimationActive) {
      particleAnimationActive = true;
      requestAnimationFrame(updateParticles);
    }
  });

  // ─── Darstellung ────────────────────────────────────────────────────────────
  // Das Sheet ist offen, solange der Finger-Modus nicht Vollbild übernimmt.
  let sheetOpen = $state(false);
  $effect(() => { sheetOpen = open && !fullscreenActive; });

  function handleSheetClose() {
    if (!fullscreenActive) close();
  }

  /** @type {HTMLDialogElement | undefined} */
  let pickerDialog = $state();
  $effect(() => {
    if (!pickerDialog) return;
    const want = open && fullscreenActive && isMobileTouch;
    if (want && !pickerDialog.open) pickerDialog.showModal();
    else if (!want && pickerDialog.open) pickerDialog.close();
  });

  /** Esc im Vollbild: zurück zum Sheet, nicht alles schließen. */
  function handlePickerClose() {
    if (fullscreenActive) {
      fullscreenActive = false;
      resetFingerPicker();
    }
  }

  const TAB_OPTIONS = [{ value: 'list', label: 'Liste' }, { value: 'picker', label: 'Finger' }];
  let showList = $derived(activeTab === 'list' || !isMobileTouch);
  let statusText = $derived(
    touchState === 'waiting' ? 'Legt eure Finger auf den Bildschirm …'
    : touchState === 'stabilizing' ? 'Finger stillhalten …'
    : touchState === 'selecting' ? 'Ziehung läuft …'
    : countdownValue && countdownValue > 0 ? String(countdownValue) : 'Los!'
  );
</script>

<Sheet bind:open={sheetOpen} title="Startspieler auslosen" size="lg" onclose={handleSheetClose}>
  {#if isMobileTouch}
    <Segmented label="Art der Auslosung" options={TAB_OPTIONS} bind:value={activeTab} onchange={resetFingerPicker} />
  {/if}

  {#if showList}
    {#if step === 'setup'}
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-4">
          <span class="font-semibold">Anzahl Spieler</span>
          <Stepper label="Spielerzahl" min={2} max={8} bind:value={playerCount} />
        </div>
        <div class="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto p-0.5">
          {#each names as _, i}
            <Field label="Name Spieler {i + 1}" hideLabel placeholder="Spieler {i + 1}" maxlength="30" bind:value={names[i]} />
          {/each}
        </div>
        <Button variant="primary" size="lg" block onclick={draw}>Startspieler ermitteln</Button>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
        {#if spinning || !winner}
          <div class="grid min-h-24 place-items-center font-display text-h1 font-semibold text-fg-2">{spinningName}</div>
        {:else}
          <Crown class="size-14 text-gold" aria-hidden="true" />
          <p class="text-fg-2">Der Startspieler ist:</p>
          <p class="font-display text-score font-semibold">{winner}</p>
          <div class="mt-2 flex w-full gap-2.5">
            <Button variant="secondary" size="lg" class="flex-1" onclick={draw}>Nochmal auslosen</Button>
            <Button variant="primary" size="lg" class="flex-1" onclick={close}>Fertig</Button>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="flex flex-col items-center gap-4 py-4 text-center">
      <span class="grid size-16 place-items-center rounded-full bg-accent-soft text-accent-soft-fg"><Hand class="size-8" aria-hidden="true" /></span>
      <p class="text-fg-2">Alle legen einen Finger auf das Display. Nach einem Countdown bestimmt die App zufällig den Startspieler.</p>
      <Button variant="primary" size="lg" block onclick={() => { fullscreenActive = true; resetFingerPicker(); }}>
        <Dices class="size-5" aria-hidden="true" />Finger-Auslosung starten
      </Button>
    </div>
  {/if}
</Sheet>

<dialog bind:this={pickerDialog} class="picker" aria-label="Startspieler per Finger auslosen" onclose={handlePickerClose}>
  {#if fullscreenActive && isMobileTouch}
    <div class="picker__surface" use:touchSurface>
      <p class="picker__status" role="status">
        <span class={touchState === 'countdown' ? 'font-display text-timer font-semibold' : 'text-lg font-semibold text-fg-2'}>{statusText}</span>
      </p>

      {#each activeTouches as finger (finger.id)}
        <span class={['picker__finger', winnerTouchId === finger.id && 'is-winner', winnerTouchId !== null && winnerTouchId !== finger.id && 'is-loser']}
          style:left="{finger.x}px" style:top="{finger.y}px" style:--finger={finger.color} aria-hidden="true">
          {#if winnerTouchId === finger.id}<Crown class="picker__crown size-10 text-gold" />{/if}
        </span>
      {/each}

      {#each particles as p (p.id)}
        <span class="picker__particle" aria-hidden="true"
          style:left="{p.x}px" style:top="{p.y}px" style:width="{p.size}px" style:height="{p.size}px"
          style:background={p.color} style:opacity={p.opacity}></span>
      {/each}
    </div>

    <IconButton variant="outline" label="Schließen" class="picker__close bg-surface" onclick={() => pickerDialog?.close()}>
      <X class="size-5" aria-hidden="true" />
    </IconButton>

    {#if touchState === 'finished'}
      <div class="picker__result">
        <Crown class="size-12 text-gold" aria-hidden="true" />
        <p class="text-fg-2">Der Startspieler ist:</p>
        <p class="font-display text-h1 font-semibold">{pickerWinnerName}</p>
        <div class="flex w-full gap-2.5">
          <Button variant="secondary" size="lg" class="flex-1" onclick={resetFingerPicker}>Nochmal auslosen</Button>
          <Button variant="primary" size="lg" class="flex-1" onclick={close}>Fertig</Button>
        </div>
      </div>
    {/if}
  {/if}
</dialog>

<style>
  .picker { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0;
    border: 0; background: var(--bg); color: var(--text); overflow: hidden; }
  .picker::backdrop { background: transparent; }
  .picker__surface { position: absolute; inset: 0; touch-action: none; user-select: none; -webkit-user-select: none; }
  .picker__status { position: absolute; inset: 0 0 auto 0; padding-top: 22dvh; text-align: center; pointer-events: none; }
  .picker__finger { position: absolute; width: 96px; height: 96px; transform: translate(-50%, -50%); border-radius: 50%;
    border: 5px solid var(--finger); background: color-mix(in oklab, var(--finger) 22%, transparent); pointer-events: none;
    transition: transform var(--dur-3) var(--ease-standard), opacity var(--dur-3); display: grid; place-items: center; }
  .picker__finger.is-winner { border-color: var(--gold); background: color-mix(in oklab, var(--gold) 28%, transparent); transform: translate(-50%, -50%) scale(1.3); }
  .picker__finger.is-loser { opacity: 0.35; }
  .picker__finger :global(.picker__crown) { position: absolute; bottom: calc(100% + 4px); }
  .picker__particle { position: absolute; border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); }
  .picker :global(.picker__close) { position: absolute; top: max(12px, env(safe-area-inset-top)); right: 12px; z-index: 5; }
  .picker__result { position: absolute; inset: auto 0 0 0; z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); text-align: center; background: var(--surface);
    border-radius: var(--r-lg) var(--r-lg) 0 0; box-shadow: var(--sh-2); }
</style>
