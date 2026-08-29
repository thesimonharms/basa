import { AudioOut, detectAudio, silentRequested, type AudioClip, type AudioDetection } from '@mudah-cli/audio';
import type { Grade } from './types.js';

const SAMPLE_RATE = 44100;

/** A BasaFx is a tiny sound effect player with two one-shots. */
export class BasaFx {
  private audio: AudioOut | null = null;
  readonly detection: AudioDetection | null;

  private constructor(audio: AudioOut | null, detection: AudioDetection | null) {
    this.audio = audio;
    this.detection = detection;
  }

  /** Probe + open. Returns a silent instance if no backend is available. */
  static async open(): Promise<BasaFx> {
    if (silentRequested()) return new BasaFx(null, null);
    const detection = detectAudio();
    if (detection.backend === 'silent') return new BasaFx(null, detection);
    try {
      const audio = await AudioOut.open({ sampleRate: SAMPLE_RATE, channels: 1 });
      return new BasaFx(audio, detection);
    } catch {
      return new BasaFx(null, detection);
    }
  }

  get isLive(): boolean {
    return this.audio !== null;
  }

  /** Play the "you got it" sound. Grade 2 (Good) and 3 (Easy) → happy ding. */
  async playCorrect(grade: Grade): Promise<void> {
    if (this.audio === null) return;
    const clip = grade === 3 ? happyChirp() : ding();
    await this.audio.play(clip);
  }

  /** Play the "not quite" sound. Grade 0 (Again) → low buzz. */
  async playIncorrect(): Promise<void> {
    if (this.audio === null) return;
    await this.audio.play(buzz());
  }

  async dispose(): Promise<void> {
    this.audio?.dispose();
    this.audio = null;
  }
}

/**
 * A two-note ascending arpeggio (C5 → E5). Quick, bright, low-volume.
 * 0.18s total.
 */
function ding(): AudioClip {
  const samples = renderSequence([
    { freq: 523.25, durationMs: 90, volume: 0.4 },
    { freq: 659.25, durationMs: 90, volume: 0.4 },
  ]);
  return { samples, sampleRate: SAMPLE_RATE, channels: 1 };
}

/** Three ascending notes (C5 → E5 → G5). Triumphant. 0.30s total. */
function happyChirp(): AudioClip {
  const samples = renderSequence([
    { freq: 523.25, durationMs: 80, volume: 0.45 },
    { freq: 659.25, durationMs: 80, volume: 0.45 },
    { freq: 783.99, durationMs: 140, volume: 0.5 },
  ]);
  return { samples, sampleRate: SAMPLE_RATE, channels: 1 };
}

/** Two low square-ish pulses. 0.20s total. */
function buzz(): AudioClip {
  const samples = renderSequence([
    { freq: 196.0, durationMs: 90, volume: 0.35, pulse: true },
    { freq: 164.81, durationMs: 90, volume: 0.35, pulse: true },
  ]);
  return { samples, sampleRate: SAMPLE_RATE, channels: 1 };
}

interface Note {
  freq: number;
  durationMs: number;
  volume: number;
  pulse?: boolean;
}

function renderSequence(notes: Note[]): Int16Array {
  const total = notes.reduce((sum, n) => sum + Math.ceil((n.durationMs / 1000) * SAMPLE_RATE), 0);
  const out = new Int16Array(total);
  let cursor = 0;
  for (const note of notes) {
    const frames = Math.ceil((note.durationMs / 1000) * SAMPLE_RATE);
    for (let i = 0; i < frames; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = triangle(i, frames);
      const value = Math.sin(2 * Math.PI * note.freq * t) * envelope * note.volume;
      const square = note.pulse ? (Math.sin(2 * Math.PI * note.freq * t) >= 0 ? 1 : -1) : 0;
      const mixed = note.pulse ? 0.6 * value + 0.4 * square * note.volume * envelope : value;
      out[cursor + i] = Math.max(-1, Math.min(1, mixed)) * 0x7fff;
    }
    cursor += frames;
  }
  return out;
}

function triangle(i: number, total: number): number {
  // Quick attack, slow release: 0..0.05 then linear decay to 0.
  const attack = 0.05;
  const t = i / total;
  if (t < attack) return t / attack;
  return Math.max(0, 1 - (t - attack) / (1 - attack));
}
