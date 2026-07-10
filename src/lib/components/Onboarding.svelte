<script>
  import { HapticService } from '$lib/services/HapticService.js';
  import { trapFocus } from '$lib/utils/a11y.js';
  import { storeProfile } from '$lib/services/DbService.js';
  import { DEFAULT_PLAYER_COLORS, loadPlayerProfiles } from '$lib/stores/app.js';

  const { onComplete = () => {} } = $props();

  // 0–2 = slides, 3 = setup step
  let step = $state(0);
  const SLIDE_COUNT = 3;

  // Setup step state
  let playerName = $state('');
  let selectedColor = $state(DEFAULT_PLAYER_COLORS[0]);
  let saving = $state(false);
  let nameError = $state('');

  function nextSlide() {
    HapticService.lightTap();
    if (step < SLIDE_COUNT - 1) {
      step++;
    } else {
      step = SLIDE_COUNT; // go to setup
    }
  }

  function goToSlide(idx) {
    HapticService.lightTap();
    step = idx;
  }

  function skipToSetup() {
    HapticService.lightTap();
    step = SLIDE_COUNT;
  }

  async function finish(wantsAuth) {
    HapticService.lightTap();
    const name = playerName.trim();
    if (name.length < 2) {
      nameError = 'Mindestens 2 Zeichen.';
      return;
    }
    saving = true;
    try {
      await storeProfile({ name, color: selectedColor, avatar: '🎲' });
      await loadPlayerProfiles();
    } catch (_) {}
    saving = false;
    localStorage.setItem('bg_onboarding_completed', 'true');
    onComplete({ wantsAuth });
  }

  function skipSetup() {
    HapticService.lightTap();
    localStorage.setItem('bg_onboarding_completed', 'true');
    onComplete({ wantsAuth: false });
  }
</script>

<div class="onboarding-overlay">
  <div class="onboarding-card glass-panel animate-onboarding" use:trapFocus>

    {#if step < SLIDE_COUNT}
      <!-- ── Slide phase ── -->
      {#if step < SLIDE_COUNT - 1}
        <button class="btn-skip" onclick={skipToSetup}>Überspringen</button>
      {/if}

      <div class="carousel-container">
        <div class="slides-wrapper" style="transform: translateX(-{step * 100}%)">

          <!-- Slide 0: Spielabend ohne Zettelchaos -->
          <div class="slide" class:active={step === 0}>
            <div class="slide-illustration">
              <div class="illu-glow"></div>
              <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illu-svg">
                <!-- Table surface -->
                <ellipse cx="100" cy="125" rx="80" ry="20" fill="rgba(99,102,241,0.08)" />
                <!-- Crumpled paper (left, faded) -->
                <rect x="18" y="72" width="44" height="54" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" transform="rotate(-8 18 72)"/>
                <line x1="26" y1="88" x2="52" y2="88" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
                <line x1="26" y1="96" x2="48" y2="96" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
                <line x1="26" y1="104" x2="50" y2="104" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
                <!-- Pencil -->
                <rect x="58" y="100" width="6" height="28" rx="2" fill="rgba(248,200,80,0.6)" transform="rotate(20 58 100)"/>
                <polygon points="58,128 64,128 61,136" fill="rgba(220,220,220,0.5)" transform="rotate(20 58 100)"/>
                <!-- Phone (right, glowing) -->
                <rect x="112" y="58" width="60" height="82" rx="10" fill="rgba(20,24,40,0.9)" stroke="rgba(99,102,241,0.6)" stroke-width="2"/>
                <rect x="118" y="67" width="48" height="56" rx="5" fill="rgba(99,102,241,0.12)"/>
                <!-- Score rows on phone -->
                <rect x="122" y="72" width="20" height="6" rx="3" fill="rgba(99,102,241,0.5)"/>
                <rect x="145" y="72" width="16" height="6" rx="3" fill="rgba(99,102,241,0.3)"/>
                <rect x="122" y="83" width="20" height="6" rx="3" fill="rgba(172,90,255,0.4)"/>
                <rect x="145" y="83" width="16" height="6" rx="3" fill="rgba(172,90,255,0.25)"/>
                <rect x="122" y="94" width="20" height="6" rx="3" fill="rgba(52,211,153,0.4)"/>
                <rect x="145" y="94" width="16" height="6" rx="3" fill="rgba(52,211,153,0.25)"/>
                <!-- Total bar -->
                <rect x="122" y="108" width="40" height="8" rx="4" fill="rgba(99,102,241,0.7)"/>
                <!-- Phone home indicator -->
                <rect x="133" y="133" width="16" height="3" rx="2" fill="rgba(255,255,255,0.2)"/>
                <!-- Dice floating -->
                <rect x="74" y="54" width="22" height="22" rx="5" fill="rgba(99,102,241,0.8)" transform="rotate(-12 74 54)"/>
                <circle cx="80" cy="60" r="2" fill="white" opacity="0.9"/>
                <circle cx="90" cy="70" r="2" fill="white" opacity="0.9"/>
                <circle cx="80" cy="70" r="2" fill="white" opacity="0.5"/>
                <circle cx="90" cy="60" r="2" fill="white" opacity="0.5"/>
              </svg>
            </div>
            <h2 class="slide-title">Schluss mit Zettelchaos</h2>
            <p class="slide-description">Nie wieder Stift und Kopfrechnen. Punkte eingeben, der Rest passiert automatisch.</p>
          </div>

          <!-- Slide 1: Wertungsbögen -->
          <div class="slide" class:active={step === 1}>
            <div class="slide-illustration">
              <div class="illu-glow" style="background: radial-gradient(circle, hsla(172,90%,45%,0.35) 0%, transparent 70%)"></div>
              <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illu-svg">
                <!-- Score card background -->
                <rect x="30" y="20" width="140" height="120" rx="14" fill="rgba(20,24,40,0.85)" stroke="rgba(99,102,241,0.35)" stroke-width="1.5"/>
                <!-- Header bar -->
                <rect x="30" y="20" width="140" height="28" rx="14" fill="rgba(99,102,241,0.25)"/>
                <rect x="30" y="34" width="140" height="14" fill="rgba(99,102,241,0.25)"/>
                <circle cx="48" cy="34" r="8" fill="rgba(99,102,241,0.6)"/>
                <text x="47" y="38" font-size="9" fill="white" text-anchor="middle" font-family="system-ui">A</text>
                <circle cx="72" cy="34" r="8" fill="rgba(172,90,255,0.6)"/>
                <text x="71" y="38" font-size="9" fill="white" text-anchor="middle" font-family="system-ui">B</text>
                <circle cx="96" cy="34" r="8" fill="rgba(52,211,153,0.6)"/>
                <text x="95" y="38" font-size="9" fill="white" text-anchor="middle" font-family="system-ui">C</text>
                <!-- Category rows -->
                <rect x="42" y="58" width="50" height="7" rx="3.5" fill="rgba(255,255,255,0.08)"/>
                <rect x="98" y="58" width="20" height="7" rx="3.5" fill="rgba(99,102,241,0.4)"/>
                <rect x="122" y="58" width="18" height="7" rx="3.5" fill="rgba(172,90,255,0.3)"/>
                <rect x="144" y="58" width="18" height="7" rx="3.5" fill="rgba(52,211,153,0.3)"/>

                <rect x="42" y="72" width="50" height="7" rx="3.5" fill="rgba(255,255,255,0.08)"/>
                <rect x="98" y="72" width="20" height="7" rx="3.5" fill="rgba(99,102,241,0.4)"/>
                <rect x="122" y="72" width="18" height="7" rx="3.5" fill="rgba(172,90,255,0.3)"/>
                <rect x="144" y="72" width="18" height="7" rx="3.5" fill="rgba(52,211,153,0.3)"/>

                <rect x="42" y="86" width="50" height="7" rx="3.5" fill="rgba(255,255,255,0.08)"/>
                <rect x="98" y="86" width="20" height="7" rx="3.5" fill="rgba(99,102,241,0.4)"/>
                <rect x="122" y="86" width="18" height="7" rx="3.5" fill="rgba(172,90,255,0.3)"/>
                <rect x="144" y="86" width="18" height="7" rx="3.5" fill="rgba(52,211,153,0.3)"/>

                <!-- Divider -->
                <line x1="40" y1="102" x2="162" y2="102" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
                <!-- Total row -->
                <rect x="42" y="108" width="50" height="9" rx="4.5" fill="rgba(255,255,255,0.12)"/>
                <rect x="98" y="108" width="20" height="9" rx="4.5" fill="rgba(99,102,241,0.75)"/>
                <rect x="122" y="108" width="18" height="9" rx="4.5" fill="rgba(172,90,255,0.55)"/>
                <rect x="144" y="108" width="18" height="9" rx="4.5" fill="rgba(52,211,153,0.55)"/>
                <!-- Crown on winner -->
                <text x="108" y="106" font-size="10" text-anchor="middle" font-family="system-ui">👑</text>
              </svg>
            </div>
            <h2 class="slide-title">Bögen für jedes Spiel</h2>
            <p class="slide-description">Maßgeschneidert für über 20 Spiele — komplexe Boni und Set-Wertungen inklusive.</p>
          </div>

          <!-- Slide 2: Historie & Rivalitäten -->
          <div class="slide" class:active={step === 2}>
            <div class="slide-illustration">
              <div class="illu-glow" style="background: radial-gradient(circle, hsla(38,90%,55%,0.3) 0%, transparent 70%)"></div>
              <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illu-svg">
                <!-- Podium -->
                <rect x="70" y="95" width="36" height="40" rx="6" fill="rgba(99,102,241,0.7)"/>
                <rect x="38" y="110" width="30" height="25" rx="6" fill="rgba(99,102,241,0.4)"/>
                <rect x="108" y="118" width="30" height="17" rx="6" fill="rgba(99,102,241,0.3)"/>
                <!-- Position labels -->
                <text x="88" y="120" font-size="11" fill="white" text-anchor="middle" font-weight="bold" font-family="system-ui">1</text>
                <text x="53" y="128" font-size="11" fill="white" text-anchor="middle" font-weight="bold" font-family="system-ui">2</text>
                <text x="123" y="132" font-size="11" fill="white" text-anchor="middle" font-weight="bold" font-family="system-ui">3</text>
                <!-- Player avatars -->
                <circle cx="88" cy="82" r="13" fill="rgba(99,102,241,0.6)" stroke="rgba(99,102,241,1)" stroke-width="2"/>
                <text x="88" y="87" font-size="12" text-anchor="middle" font-family="system-ui">🎲</text>
                <circle cx="53" cy="98" r="11" fill="rgba(172,90,255,0.5)" stroke="rgba(172,90,255,0.9)" stroke-width="1.5"/>
                <text x="53" y="103" font-size="10" text-anchor="middle" font-family="system-ui">🃏</text>
                <circle cx="123" cy="106" r="11" fill="rgba(52,211,153,0.4)" stroke="rgba(52,211,153,0.8)" stroke-width="1.5"/>
                <text x="123" y="111" font-size="10" text-anchor="middle" font-family="system-ui">♟</text>
                <!-- Crown -->
                <text x="88" y="66" font-size="16" text-anchor="middle" font-family="system-ui">👑</text>
                <!-- Stats bar chart (top right) -->
                <rect x="148" y="52" width="8" height="40" rx="4" fill="rgba(99,102,241,0.6)"/>
                <rect x="160" y="62" width="8" height="30" rx="4" fill="rgba(172,90,255,0.5)"/>
                <rect x="172" y="72" width="8" height="20" rx="4" fill="rgba(52,211,153,0.4)"/>
                <!-- Trend line -->
                <polyline points="20,80 36,65 52,70 68,50 84,42" stroke="rgba(248,200,80,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="84" cy="42" r="3" fill="rgba(248,200,80,0.9)"/>
              </svg>
            </div>
            <h2 class="slide-title">Wer ist Champion?</h2>
            <p class="slide-description">Verfolge Highscores, Siegquoten und Rivalitäten — über alle Abende hinweg.</p>
          </div>

        </div>
      </div>

      <!-- Dots & Navigation -->
      <div class="onboarding-footer">
        <div class="dots-container">
          {#each Array(SLIDE_COUNT) as _, idx}
            <button
              class="dot"
              class:active={step === idx}
              onclick={() => goToSlide(idx)}
              aria-label="Gehe zu Slide {idx + 1}"
            ></button>
          {/each}
        </div>
        <button class="btn-next glass-button" onclick={nextSlide}>
          {step === SLIDE_COUNT - 1 ? 'Los geht\'s →' : 'Weiter →'}
        </button>
      </div>

    {:else}
      <!-- ── Setup step ── -->
      <div class="setup-step" class:active={step === SLIDE_COUNT}>
        <div class="setup-icon">🎲</div>
        <h2 class="setup-title">Wie heißt du?</h2>
        <p class="setup-desc">Leg dein Spielerprofil an — für Statistiken und Bestenlisten.</p>

        <div class="name-field">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            class="name-input"
            class:error={!!nameError}
            placeholder="Dein Name"
            bind:value={playerName}
            maxlength="24"
            oninput={() => nameError = ''}
            onkeydown={(e) => e.key === 'Enter' && finish(false)}
            autofocus
          />
          {#if nameError}
            <span class="name-error">{nameError}</span>
          {/if}
        </div>

        <div class="color-row">
          {#each DEFAULT_PLAYER_COLORS.slice(0, 6) as color}
            <button
              class="color-dot"
              class:selected={selectedColor === color}
              style="background: {color}"
              onclick={() => { HapticService.lightTap(); selectedColor = color; }}
              aria-label="Farbe auswählen"
            ></button>
          {/each}
        </div>

        <div class="setup-actions">
          <button
            class="btn-local"
            onclick={() => finish(false)}
            disabled={saving}
          >
            {saving ? 'Speichern…' : 'Lokal starten'}
          </button>
          <button
            class="btn-register"
            onclick={() => finish(true)}
            disabled={saving}
          >
            Konto erstellen
          </button>
        </div>

        <button class="btn-skip-setup" onclick={skipSetup}>
          Ohne Profil fortfahren
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    background: rgba(5, 7, 12, 0.88);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .onboarding-card {
    width: 100%;
    max-width: 440px;
    background: linear-gradient(135deg, rgba(20, 24, 40, 0.88) 0%, rgba(10, 14, 26, 0.97) 100%);
    border: 1px solid var(--color-border-glass);
    border-radius: 28px;
    padding: 32px 24px 24px;
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.1);
    min-height: 420px;
  }

  /* ── Skip button ── */
  .btn-skip {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    z-index: 10;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color 0.2s, background 0.2s;
  }
  .btn-skip:hover { color: var(--color-text-primary); background: rgba(255,255,255,0.05); }

  /* ── Carousel ── */
  .carousel-container {
    overflow: hidden;
    width: 100%;
    flex: 1;
  }

  .slides-wrapper {
    display: flex;
    transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
    width: 100%;
  }

  .slide {
    min-width: 100%;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px 8px 0;
  }

  /* ── Illustration ── */
  .slide-illustration {
    width: 100%;
    height: 168px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .illu-glow {
    position: absolute;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--color-primary-glow) 0%, transparent 70%);
    opacity: 0.55;
    filter: blur(24px);
    z-index: 1;
    pointer-events: none;
    animation: pulseGlow 4s ease-in-out infinite alternate;
  }

  @keyframes pulseGlow {
    0%   { transform: scale(0.9); opacity: 0.4; }
    100% { transform: scale(1.1); opacity: 0.65; }
  }

  .illu-svg {
    position: relative;
    z-index: 2;
    width: 200px;
    height: 160px;
    opacity: 0;
    transform: translateY(16px) scale(0.92);
    transition: opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
                transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .slide.active .illu-svg {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .slide-title {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-text-primary);
    margin: 0 0 10px 0;
    letter-spacing: -0.01em;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s,
                transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s;
  }
  .slide.active .slide-title { opacity: 1; transform: translateY(0); }

  .slide-description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
    padding: 0 8px;
    margin: 0;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s,
                transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s;
  }
  .slide.active .slide-description { opacity: 1; transform: translateY(0); }

  /* ── Footer ── */
  .onboarding-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .dots-container { display: flex; gap: 8px; }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-border-glass);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .dot.active {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    width: 24px;
    border-radius: 4px;
    box-shadow: 0 0 10px var(--color-primary-glow);
  }

  .btn-next {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    color: white;
    font-weight: 700;
    font-size: 0.92rem;
    padding: 10px 22px;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    transition: box-shadow 0.25s, transform 0.25s;
  }
  .btn-next:hover { box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6); transform: translateY(-1px); }
  .btn-next:active { transform: translateY(0); }

  /* ── Setup step ── */
  .setup-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .setup-step.active {
    opacity: 1;
    transform: translateY(0);
  }

  .setup-icon {
    font-size: 2.8rem;
    margin-bottom: 10px;
    filter: drop-shadow(0 4px 12px rgba(99,102,241,0.5));
  }

  .setup-title {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-primary);
    margin: 0 0 6px 0;
  }

  .setup-desc {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0 0 22px 0;
    text-align: center;
  }

  .name-field {
    width: 100%;
    margin-bottom: 16px;
    position: relative;
  }

  .name-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: var(--color-text-primary);
    font-size: 1.05rem;
    font-weight: 600;
    padding: 12px 16px;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
    text-align: center;
  }
  .name-input:focus {
    border-color: var(--color-primary);
    background: rgba(99, 102, 241, 0.08);
  }
  .name-input.error { border-color: hsl(0, 80%, 60%); }
  .name-input::placeholder { color: var(--color-text-muted); font-weight: 400; }

  .name-error {
    display: block;
    margin-top: 5px;
    font-size: 0.78rem;
    color: hsl(0, 80%, 65%);
    text-align: center;
  }

  .color-row {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .color-dot {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .color-dot:hover { transform: scale(1.15); }
  .color-dot.selected {
    border-color: white;
    transform: scale(1.18);
    box-shadow: 0 0 10px rgba(255,255,255,0.4);
  }

  .setup-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-bottom: 12px;
  }

  .btn-local {
    flex: 1;
    padding: 11px 16px;
    border-radius: 14px;
    border: 1.5px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: var(--color-text-primary);
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .btn-local:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); }
  .btn-local:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-register {
    flex: 1;
    padding: 11px 16px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    color: white;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .btn-register:hover { box-shadow: 0 6px 18px rgba(99,102,241,0.6); transform: translateY(-1px); }
  .btn-register:active { transform: translateY(0); }
  .btn-register:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-skip-setup {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color 0.2s;
  }
  .btn-skip-setup:hover { color: var(--color-text-secondary); }

  @keyframes scaleUp {
    from { transform: scale(0.93); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  .animate-onboarding {
    animation: scaleUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
</style>
