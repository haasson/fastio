/**
 * Centralized alert system for the admin panel.
 *
 * - Tab focused: plays a beep sound via Web Audio API
 * - Tab hidden: shows an OS-level notification (Notification API)
 *   that triggers a system sound even when the user is on another tab
 *
 * Usage: call requestNotificationPermission() on first user interaction.
 * Alerts: alertNewOrder(), alertTableCall(callTypeName)
 */

let audioCtx: AudioContext | null = null

const getAudioCtx = () => {
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()

  return audioCtx
}

const playBeep = (frequency: number, duration: number, delay = 0) => {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.25, ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime + delay + duration)
  } catch {
    // AudioContext unavailable or user hasn't interacted with the page yet
  }
}

const notify = (title: string, body: string, tag: string) => {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag })
  } catch {
    // Notifications blocked by browser/OS
  }
}

export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

export const alertNewOrder = () => {
  if (document.visibilityState === 'visible') {
    playBeep(880, 0.25)
  } else {
    notify('Новый заказ', 'Поступил новый заказ', 'fastio-order')
  }
}

export const alertTableCall = (callTypeName: string) => {
  if (document.visibilityState === 'visible') {
    playBeep(660, 0.15)
    playBeep(880, 0.2, 0.2)
  } else {
    notify('Вызов официанта', callTypeName, 'fastio-call')
  }
}
