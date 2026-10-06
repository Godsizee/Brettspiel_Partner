// @ts-check
/**
 * Globaler Partie-Timer. Früher lebte die GameTimer-Instanz in GameTimer.svelte und tickte nur,
 * solange der Timer-Screen montiert war (Stolperfalle S21). Jetzt läuft sie app-weit: die
 * Live-Leiste tickt auf jedem Screen, der Alarm löst überall aus.
 */
import { get } from 'svelte/store';
import { GameTimer } from '$lib/services/GameTimer.js';
import { HapticService } from '$lib/services/HapticService.js';
import {
  timerState, timerText, timerElapsedSeconds, currentGame, currentSessionDuration, settings, gamesCatalog, showToast,
} from './app.js';

const timer = new GameTimer();
const onTick = (/** @type {string} */ fmt, /** @type {number} */ secs) => { timerText.set(fmt); timerElapsedSeconds.set(secs); };

/** Alarm-Schwellen, die in dieser Partie schon gemeldet wurden. */
const notified = new Set();

/** Beim App-Start (bootstrap.js) — vorher nur, wenn der Timer-Screen montiert war (S21). */
export function recoverMatchTimer() {
  const stored = localStorage.getItem('bg_timer_state');
  if (stored && stored !== 'stopped' && timer.recoverActiveTimer(onTick)) {
    timerState.set(/** @type {'running'|'paused'} */ (timer.state));
  }
}

/** Startet die Partie bzw. setzt sie nach einer Pause fort. */
export function startOrResumeMatchTimer() {
  const game = get(currentGame);
  if (get(timerState) === 'stopped' && game) localStorage.setItem('bg_timer_current_game', game);
  HapticService.timerStart();
  timer.start(onTick);
  timerState.set('running');
}

export function pauseMatchTimer() {
  HapticService.timerPause();
  timer.pause();
  timerState.set('paused');
}

/** Partie beenden → Dauer (Sekunden) landet in currentSessionDuration, für die Wertung. */
export function finishMatchTimer() {
  HapticService.timerStop();
  const duration = timer.stop();
  timerState.set('stopped');
  timerElapsedSeconds.set(0);
  timerText.set('00:00:00');
  currentSessionDuration.set(duration);
  localStorage.removeItem('bg_timer_current_game');
  notified.clear();
  return duration;
}

/** Partie abbrechen (Zeit verwerfen), ohne Navigation und Toast. */
export function abortMatchTimer() {
  HapticService.timerStop();
  timer.stop();
  timerText.set('00:00:00');
  timerElapsedSeconds.set(0);
  timerState.set('stopped');
  localStorage.removeItem('bg_timer_current_game');
  currentSessionDuration.set(0);
  notified.clear();
}

/** Schlüssel des Spiels, für das gerade ein Timer läuft (nicht zwingend das angezeigte Spiel). */
export function runningGameKey() {
  return get(timerState) === 'stopped' ? null : (localStorage.getItem('bg_timer_current_game') ?? get(currentGame));
}

// Alarm nach N Minuten — global, damit er auch auf anderen Screens auslöst (F5).
timerElapsedSeconds.subscribe((secs) => {
  const s = get(settings);
  const alertMinutes = s.timerAlarmDurationMinutes || 120;
  const mins = Math.floor(secs / 60);
  if (s.notificationsEnabled && mins > 0 && mins % alertMinutes === 0 && !notified.has(mins)) {
    notified.add(mins);
    notifyLongMatch(mins);
  }
});

/** @param {number} minutes */
async function notifyLongMatch(minutes) {
  const key = runningGameKey();
  const gameName = key ? (get(gamesCatalog)[key]?.name ?? key) : 'Spiel';
  const hours = Math.floor(minutes / 60);
  const timeStr = hours > 0 ? `${hours} Stunde(n)` : `${minutes} Minuten`;
  const message = `Eure Partie ${gameName} dauert bereits ${timeStr}!`;

  showToast(`Alarm: ${message}`, 'warning');

  // Beep sound
  try {
    const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    const audioCtx = new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    console.warn('Audio Context beep failed', e);
  }

  // Local notification (Icon mit Base-Pfad, S22)
  if ('Notification' in window) {
    const icon = `${import.meta.env.BASE_URL}icon-192.png`;
    if (Notification.permission === 'granted') {
      new Notification('Boardgame Companion', { body: message, icon });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') new Notification('Boardgame Companion', { body: message, icon });
    }
  }
}
