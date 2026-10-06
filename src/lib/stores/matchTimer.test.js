import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';

// app.js braucht window/Router — für den Timer genügen die echten Stores darin.
vi.mock('./app.js', () => ({
  timerState: writable('stopped'),
  timerText: writable('00:00:00'),
  timerElapsedSeconds: writable(0),
  currentGame: writable(null),
  currentSessionDuration: writable(0),
  settings: writable({ timerAlarmDurationMinutes: 120, notificationsEnabled: false }),
  gamesCatalog: writable({}),
  showToast: vi.fn(),
}));
vi.mock('$lib/services/HapticService.js', () => ({
  HapticService: { timerStart() {}, timerPause() {}, timerStop() {}, lightTap() {} },
}));

// Echter (kleiner) localStorage statt der Mocks aus tests/setup.js — der Timer persistiert dort.
function memoryStorage() {
  /** @type {Record<string, string>} */
  let data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { data = {}; },
  };
}

describe('matchTimer', () => {
  let m;
  let app;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    vi.stubGlobal('localStorage', memoryStorage());
    vi.resetModules();
    app = await import('./app.js');
    m = await import('./matchTimer.js');
  });

  afterEach(() => {
    m.abortMatchTimer();
    vi.useRealTimers();
  });

  it('startet für das aktuelle Spiel, pausiert und setzt fort', () => {
    app.currentGame.set('on mars');
    m.startOrResumeMatchTimer();
    expect(get(app.timerState)).toBe('running');
    expect(localStorage.getItem('bg_timer_current_game')).toBe('on mars');
    expect(m.runningGameKey()).toBe('on mars');

    vi.advanceTimersByTime(65_000);
    expect(get(app.timerText)).toBe('00:01:05');

    m.pauseMatchTimer();
    vi.advanceTimersByTime(30_000);
    expect(get(app.timerState)).toBe('paused');
    expect(get(app.timerText)).toBe('00:01:05');

    m.startOrResumeMatchTimer();
    vi.advanceTimersByTime(5_000);
    expect(get(app.timerText)).toBe('00:01:10');
  });

  it('runningGameKey bleibt beim Spiel der Partie, auch wenn currentGame wechselt', () => {
    app.currentGame.set('on mars');
    m.startOrResumeMatchTimer();
    app.currentGame.set('mischwald');
    expect(m.runningGameKey()).toBe('on mars');
  });

  it('finishMatchTimer übergibt die Dauer und räumt auf', () => {
    app.currentGame.set('on mars');
    m.startOrResumeMatchTimer();
    vi.advanceTimersByTime(125_000);
    const duration = m.finishMatchTimer();
    expect(duration).toBe(125);
    expect(get(app.currentSessionDuration)).toBe(125);
    expect(get(app.timerState)).toBe('stopped');
    expect(get(app.timerText)).toBe('00:00:00');
    expect(localStorage.getItem('bg_timer_current_game')).toBeNull();
    expect(m.runningGameKey()).toBeNull();
  });

  it('abortMatchTimer verwirft die Zeit', () => {
    app.currentGame.set('on mars');
    m.startOrResumeMatchTimer();
    vi.advanceTimersByTime(60_000);
    m.abortMatchTimer();
    expect(get(app.currentSessionDuration)).toBe(0);
    expect(get(app.timerState)).toBe('stopped');
  });

  it('recoverMatchTimer stellt einen laufenden Timer nach Reload wieder her', () => {
    localStorage.setItem('bg_timer_state', 'running');
    localStorage.setItem('bg_timer_start_time', String(Date.now() - 90_000));
    localStorage.setItem('bg_timer_accumulated_time', '0');
    // Neue Modulinstanz = „Reload“: GameTimer liest den Zustand im Konstruktor
    return (async () => {
      vi.resetModules();
      const app2 = await import('./app.js');
      const m2 = await import('./matchTimer.js');
      m2.recoverMatchTimer();
      expect(get(app2.timerState)).toBe('running');
      expect(get(app2.timerText)).toBe('00:01:30');
      m2.abortMatchTimer();
    })();
  });
});
