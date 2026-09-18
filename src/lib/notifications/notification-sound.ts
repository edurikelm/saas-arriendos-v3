/**
 * Sonido de notificación nueva: dos tonos cortos sintetizados con Web Audio,
 * sin archivo de audio que servir ni cachear.
 *
 * Los navegadores solo dejan sonar a una página después de que el usuario
 * interactuó con ella. `primeNotificationSound()` se engancha al primer
 * click/tecla para crear el AudioContext dentro de ese gesto; si el usuario
 * nunca interactuó, `playNotificationSound()` no hace nada y la campana igual
 * se anima.
 *
 * La preferencia de silencio es por dispositivo (localStorage): el sonido es
 * una decisión del equipo donde se usa, no de la cuenta.
 */

const SOUND_PREFERENCE_KEY = "rentalpro:notification-sound";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

/** Sin gesto previo del usuario el navegador bloquea el audio: no intentarlo. */
function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return activation ? activation.hasBeenActive : true;
}

export function primeNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") resumeQuietly(ctx);
  } catch {
    // Best-effort: sin audio, la campana igual se anima.
  }
}

export function playNotificationSound(): void {
  try {
    if (typeof window === "undefined" || !hasUserActivation()) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") resumeQuietly(ctx);

    const start = ctx.currentTime + 0.01;
    playTone(ctx, 880, start, 0.2); // La5
    playTone(ctx, 1318.51, start + 0.12, 0.35); // Mi6
  } catch {
    // Best-effort
  }
}

/**
 * `resume()` devuelve una promesa que el navegador rechaza si todavía no deja
 * sonar; el try/catch de afuera es sincrónico y no la atraparía.
 */
function resumeQuietly(ctx: AudioContext) {
  ctx.resume().catch(() => {
    // Bloqueado por la política de autoplay: la campana igual se anima.
  });
}

function playTone(ctx: AudioContext, frequency: number, at: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Ataque corto y caída exponencial: suena a campanilla, no a pitido.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.12, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

export function isNotificationSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(SOUND_PREFERENCE_KEY);
    else window.localStorage.setItem(SOUND_PREFERENCE_KEY, "off");
  } catch {
    // Storage bloqueado (modo privado, etc.): la preferencia no persiste.
  }
}
