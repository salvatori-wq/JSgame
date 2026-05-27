// Trilha Medieval — Instrumentos sintetizados via Web Audio API.
// Cada função desenha UMA nota/hit numa AudioContext + GainNode destino, agendada
// em `time` (segundos no clock do AudioContext, NOT performance.now()).
// Usado pelo sequencer pra montar patterns rítmicos/melódicos.
//
// Princípio: instrumentos baratos (1-3 osciladores + envelope curto).
// Mobile-friendly: nenhum loop infinito; cada call cria/agenda/destrói nodes.

export interface InstrumentCtx {
  ctx: AudioContext;
  dest: AudioNode;
}

/** Pluck — alaúde/harpa sintetizado (triangle + envelope rápido + lowpass).
 *  attack ~0.005s, decay exponencial pra near-silence em ~duration.
 *  Soa "dedilhado". */
export function pluck(ic: InstrumentCtx, freq: number, time: number, duration = 0.6, gain = 0.18): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  // Segundo oscilador uma quinta acima (-2 oct = 4ª harmônica) pra timbre mais rico
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, time);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, time + duration);

  // Lowpass evolve fechando pra "abafamento" natural de corda
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(Math.min(4000, freq * 8), time);
  filt.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 2), time + duration);
  filt.Q.value = 1.2;

  osc.connect(filt);
  osc2.connect(filt);
  filt.connect(env).connect(dest);
  osc.start(time);
  osc2.start(time);
  osc.stop(time + duration + 0.05);
  osc2.stop(time + duration + 0.05);
}

/** Flute — flauta medieval (sine + sutil noise breath + vibrato leve).
 *  attack lento (~0.06s) pra dar caráter aerofone. */
export function flute(ic: InstrumentCtx, freq: number, time: number, duration = 1.2, gain = 0.14): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  // Vibrato 5Hz suave via LFO
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5, time);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = freq * 0.008; // ±0.8%
  lfo.connect(lfoGain).connect(osc.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.06);
  env.gain.setValueAtTime(gain, time + duration - 0.15);
  env.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(env).connect(dest);
  osc.start(time);
  lfo.start(time);
  osc.stop(time + duration + 0.05);
  lfo.stop(time + duration + 0.05);
}

/** Drum kick — frame drum medieval baixo (sine 80→40 Hz + click). */
export function drumKick(ic: InstrumentCtx, time: number, gain = 0.5): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

  osc.connect(env).connect(dest);
  osc.start(time);
  osc.stop(time + 0.22);
}

/** Drum tom — tambor médio (sine 200→100 Hz curto). */
export function drumTom(ic: InstrumentCtx, time: number, freq = 200, gain = 0.35): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.1);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

  osc.connect(env).connect(dest);
  osc.start(time);
  osc.stop(time + 0.18);
}

/** Hat — chimbal/pandeiro (white noise filtrado high). */
export function drumHat(ic: InstrumentCtx, time: number, gain = 0.18, duration = 0.05): void {
  const { ctx, dest } = ic;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 6000;
  filt.Q.value = 0.7;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.001);
  env.gain.exponentialRampToValueAtTime(0.001, time + duration);

  src.connect(filt).connect(env).connect(dest);
  src.start(time);
  src.stop(time + duration + 0.02);
}

/** Bell — sino místico (3 sines em harmônicos pares, decay longo).
 *  Usado em mystery/victory. */
export function bell(ic: InstrumentCtx, freq: number, time: number, duration = 2.5, gain = 0.18): void {
  const { ctx, dest } = ic;
  const partials = [1, 2.76, 5.4]; // harmônicos não-inteiros simulam bell-like
  for (let i = 0; i < partials.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * partials[i]!, time);

    const env = ctx.createGain();
    const peakGain = gain / (i + 1);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peakGain, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(env).connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

/** Heartbeat — kick duplo low-thump pra perigo crítico. */
export function heartbeat(ic: InstrumentCtx, time: number, gain = 0.35): void {
  drumKick(ic, time, gain);
  drumKick(ic, time + 0.18, gain * 0.7);
}

/** Pad sustained — drone com LFO de movimento. Retorna nodes pra parar depois.
 *  Diferente dos demais (que são one-shots) — pad fica tocando até stop manual. */
export function padDrone(
  ic: InstrumentCtx,
  freqs: number[],
  type: OscillatorType = 'sine',
  lowpassFreq?: number,
): { stop: (releaseTime: number) => void; gainNode: GainNode } {
  const { ctx, dest } = ic;
  const padGain = ctx.createGain();
  padGain.gain.value = 0;
  padGain.connect(dest);

  const nodes: Array<OscillatorNode | GainNode | BiquadFilterNode> = [padGain];
  let chain: AudioNode = padGain;
  if (lowpassFreq) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpassFreq;
    filt.Q.value = 1.5;
    filt.connect(padGain);
    chain = filt;
    nodes.push(filt);
  }

  const t0 = ctx.currentTime;
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    // LFO sutil pra cada osc (vibrato lento desconexo)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + Math.random() * 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(chain);
    osc.start(t0);
    lfo.start(t0);
    nodes.push(osc, lfo, lfoGain);
  }

  return {
    gainNode: padGain,
    stop: (releaseTime: number) => {
      const stopT = ctx.currentTime + releaseTime;
      padGain.gain.cancelScheduledValues(ctx.currentTime);
      padGain.gain.setValueAtTime(padGain.gain.value, ctx.currentTime);
      padGain.gain.exponentialRampToValueAtTime(0.0001, stopT);
      // Schedula stop final
      setTimeout(() => {
        for (const n of nodes) {
          try {
            if ('stop' in n && typeof n.stop === 'function') (n as OscillatorNode).stop();
          } catch { /* já stopado */ }
        }
      }, releaseTime * 1000 + 50);
    },
  };
}
