/**
 * timer-state.js — Persist timer state across page navigations
 * 
 * Stores active timer info in sessionStorage so it survives when
 * the technician navigates between pages and returns to sample-entry.html.
 */

const TIMER_STATE_KEY = "fieldkit_timer_state";

export function saveTimerState(timerId, elapsedSeconds) {
  const state = {
    timerId,
    elapsedSeconds,
    savedAt: Date.now()
  };
  sessionStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
}

export function getTimerState() {
  const stored = sessionStorage.getItem(TIMER_STATE_KEY);
  if (!stored) return null;
  
  try {
    const state = JSON.parse(stored);
    // Calculate how many ms have elapsed since we saved
    const msElapsed = Date.now() - state.savedAt;
    const secondsElapsed = Math.floor(msElapsed / 1000);
    
    return {
      timerId: state.timerId,
      elapsedSeconds: state.elapsedSeconds + secondsElapsed
    };
  } catch (_) {
    return null;
  }
}

export function clearTimerState() {
  sessionStorage.removeItem(TIMER_STATE_KEY);
}
