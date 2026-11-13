import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOUND_VOLUME_KEY = '@barapp:tablet_sound_volume';
export const SOUND_MUTED_KEY = '@barapp:tablet_sound_muted';

let sharedAudioCtx: any = null;
let activeTimeouts: any[] = [];
let activeOscillators: any[] = [];
let lastPlayTimestamp = 0;

function getAudioContext(): any {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

// Desbloqueia o AudioContext na primeira interação do usuário na página
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  ['click', 'touchstart', 'pointerdown', 'mousedown', 'keydown'].forEach((evtName) => {
    window.addEventListener(evtName, unlock, { passive: true });
  });
}

export function stopOrderAlertSound() {
  for (const t of activeTimeouts) {
    clearTimeout(t);
  }
  activeTimeouts = [];

  for (const osc of activeOscillators) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  }
  activeOscillators = [];
}

export async function getSavedSoundConfig(): Promise<{ volume: number; muted: boolean }> {
  try {
    const [volStr, mutedStr] = await Promise.all([
      AsyncStorage.getItem(SOUND_VOLUME_KEY),
      AsyncStorage.getItem(SOUND_MUTED_KEY),
    ]);
    const volume = volStr !== null && !Number.isNaN(Number(volStr)) ? Math.max(0, Math.min(100, Number(volStr))) : 80;
    const muted = mutedStr === 'true';
    return { volume, muted };
  } catch {
    return { volume: 80, muted: false };
  }
}

/**
 * Toca um alerta estilo telefone comercial ("Trim-Trim!") com 3 toques duplos.
 * @param customVolume Volume de 0 a 100 (opcional; se omitido, lê do AsyncStorage)
 * @param customMuted Se está mudo (opcional; se omitido, lê do AsyncStorage)
 * @param force Se true (ex: botão Testar), ignora debounce de toque recente
 */
export async function playOrderAlertSound(customVolume?: number, customMuted?: boolean, force: boolean = false) {
  try {
    const nowMs = Date.now();
    if (!force && nowMs - lastPlayTimestamp < 1200) {
      return;
    }
    lastPlayTimestamp = nowMs;

    let volume = customVolume;
    let muted = customMuted;

    if (volume === undefined || muted === undefined) {
      const saved = await getSavedSoundConfig();
      if (volume === undefined) volume = saved.volume;
      if (muted === undefined) muted = saved.muted;
    }

    // Vibração em dispositivos móveis/tablets compatíveis
    try {
      Vibration.vibrate([0, 300, 150, 300, 400, 300, 150, 300]);
    } catch {}

    if (muted || volume <= 0) {
      return;
    }

    if (Platform.OS !== 'web') {
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    // Cancela toque anterior se ainda estiver tocando para não sobrepor
    stopOrderAlertSound();

    // Ganho máximo seguro (evita distorção e permite altura bem audível em 100%)
    const normalizedGain = Math.max(0.02, Math.min(1, volume / 100)) * 0.45;

    // Função que toca um burst de "Trim" (alternância rápida entre 2 frequências de telefone: 850Hz e 1080Hz)
    const playPhoneBurst = (startDelayMs: number, durationMs: number) => {
      const tId = setTimeout(() => {
        try {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const now = ctx.currentTime;
          const durationSec = durationMs / 1000;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(850, now);

          // Modulação rápida (warble de telefone: alterna entre 850Hz e 1080Hz a cada 45ms)
          const stepSec = 0.045;
          let toggle = false;
          for (let t = 0; t < durationSec; t += stepSec) {
            osc.frequency.setValueAtTime(toggle ? 1080 : 850, now + t);
            toggle = !toggle;
          }

          // Envelope suave para evitar cliques secos
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(normalizedGain, now + 0.015);
          gain.gain.setValueAtTime(normalizedGain, now + Math.max(0.02, durationSec - 0.025));
          gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + durationSec);
          activeOscillators.push(osc);
        } catch {}
      }, startDelayMs);

      activeTimeouts.push(tId);
    };

    // 3 ciclos de toque duplo de telefone ("Trim-Trim ... Trim-Trim ... Trim-Trim")
    const ringCycles = [0, 950, 1900];
    for (const cycleStart of ringCycles) {
      playPhoneBurst(cycleStart, 260);       // Primeiro "Trim"
      playPhoneBurst(cycleStart + 320, 260); // Segundo "Trim"
    }
  } catch (err) {
    console.warn('Erro ao reproduzir som de novo pedido:', err);
  }
}
