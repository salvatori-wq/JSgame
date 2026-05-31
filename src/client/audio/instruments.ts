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

// ════════════════════════════════════════════════════════════════════════════
// Onda 2 — Orquestra medieval expandida. Recipes DSP da pesquisa (subtractive +
// additive). Toda voz melódica segue a MESMA assinatura → intercambiável no
// composer/ornamentos: (ic, freq, time, duration?, gain?).
// ════════════════════════════════════════════════════════════════════════════

/** Assinatura comum de instrumento melódico (uma nota agendada). */
export type MelodicVoice = (
  ic: InstrumentCtx, freq: number, time: number, duration?: number, gain?: number,
) => void;

/** Alaúde/gittern premium — corda dupla (2 saws detune ±6¢) + envelope de filtro
 *  (brilho no ataque → abafa) + pitch-drop de dedilhado (~10¢ em 30ms). */
export function lute(ic: InstrumentCtx, freq: number, time: number, duration = 0.7, gain = 0.18): void {
  const { ctx, dest } = ic;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0008, time + duration);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(Math.min(6500, freq * 12), time);
  filt.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.2), time + 0.22);
  filt.Q.value = 1;
  filt.connect(env).connect(dest);

  for (const cents of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = freq * Math.pow(2, cents / 1200);
    osc.frequency.setValueAtTime(f * 1.006, time);            // começa ~10¢ acima
    osc.frequency.exponentialRampToValueAtTime(f, time + 0.03); // assenta (pluck)
    osc.connect(filt);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

/** Vielle/rabeca — corda friccionada. Sawtooth + lowpass, ataque lento (bow grip
 *  ~90ms), vibrato 6Hz que ENTRA após o onset (~150ms), sustain longo. */
export function vielle(ic: InstrumentCtx, freq: number, time: number, duration = 1.4, gain = 0.12): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 6;
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, time);
  lfoGain.gain.linearRampToValueAtTime(freq * 0.012, time + 0.35); // vibrato fade-in
  lfo.connect(lfoGain).connect(osc.frequency);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = Math.min(4200, freq * 8);
  filt.Q.value = 1;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.09);          // bow grip
  env.gain.setValueAtTime(gain, time + Math.max(0.1, duration - 0.18));
  env.gain.exponentialRampToValueAtTime(0.0008, time + duration);

  osc.connect(filt).connect(env).connect(dest);
  osc.start(time); lfo.start(time);
  osc.stop(time + duration + 0.05); lfo.stop(time + duration + 0.05);
}

/** Recorder/flauta doce — triangle quase-puro + sopro (noise bandpass na nota) +
 *  pitch scoop (~15¢ baixo → afina em 40ms) + vibrato 4.5Hz no sustain. */
export function recorder(ic: InstrumentCtx, freq: number, time: number, duration = 1.2, gain = 0.11): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * 0.991, time);            // scoop: ~15¢ flat
  osc.frequency.exponentialRampToValueAtTime(freq, time + 0.04);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 4.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, time);
  lfoGain.gain.linearRampToValueAtTime(freq * 0.006, time + 0.3);
  lfo.connect(lfoGain).connect(osc.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.06);
  env.gain.setValueAtTime(gain, time + Math.max(0.1, duration - 0.12));
  env.gain.exponentialRampToValueAtTime(0.0008, time + duration);
  osc.connect(env).connect(dest);

  // Sopro: ruído bandpass centrado na nota, mais alto no ataque.
  const bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const breath = ctx.createBufferSource();
  breath.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(8000, freq * 2);
  bp.Q.value = 0.8;
  const breathEnv = ctx.createGain();
  breathEnv.gain.setValueAtTime(0, time);
  breathEnv.gain.linearRampToValueAtTime(gain * 0.4, time + 0.04);
  breathEnv.gain.exponentialRampToValueAtTime(0.0005, time + duration * 0.7);
  breath.connect(bp).connect(breathEnv).connect(dest);

  osc.start(time); lfo.start(time); breath.start(time);
  osc.stop(time + duration + 0.05); lfo.stop(time + duration + 0.05);
  breath.stop(time + duration + 0.05);
}

/** Shawm/bombarde — palheta dupla, nasal e penetrante (boss/alta capella).
 *  Sawtooth bright → bandpass formant (~1.4kHz) = honk nasal + 2ª voz detune
 *  (buzz) + vibrato 5.5Hz + tremolo de amplitude. Ataque rápido (palheta crava). */
export function shawm(ic: InstrumentCtx, freq: number, time: number, duration = 1.0, gain = 0.12): void {
  const { ctx, dest } = ic;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 1.2;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.015);        // palheta crava
  // Tremolo: oscila o sustain pra dar o "buzz" de palheta dupla.
  const trem = ctx.createOscillator();
  trem.type = 'sine'; trem.frequency.value = 5.5;
  const tremGain = ctx.createGain();
  tremGain.gain.value = gain * 0.12;
  trem.connect(tremGain).connect(env.gain);
  env.gain.setValueAtTime(gain, time + Math.max(0.05, duration - 0.1));
  env.gain.exponentialRampToValueAtTime(0.0008, time + duration);
  bp.connect(env).connect(dest);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 5.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = freq * 0.01;
  lfo.connect(lfoGain);

  for (const cents of [-5, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), time);
    lfoGain.connect(osc.frequency);
    osc.connect(bp);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
  lfo.start(time); trem.start(time);
  lfo.stop(time + duration + 0.05); trem.stop(time + duration + 0.05);
}

/** Saltério — zither dedilhado/percutido: brilhante e com cauda longa. Como o
 *  alaúde mas mais agudo (lowpass alto) + 3 vozes detune (chorus de cordas). */
export function psaltery(ic: InstrumentCtx, freq: number, time: number, duration = 1.6, gain = 0.13): void {
  const { ctx, dest } = ic;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0006, time + duration);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = Math.min(9000, freq * 10);
  filt.Q.value = 0.8;
  filt.connect(env).connect(dest);

  for (const cents of [-10, 0, 10]) {
    const osc = ctx.createOscillator();
    osc.type = cents === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), time);
    osc.connect(filt);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

/** Harpa medieval — dedilhado macio e amadeirado (triangle + sine), lowpass
 *  fechando, decay médio-longo. Mais doce que o saltério. */
export function harp(ic: InstrumentCtx, freq: number, time: number, duration = 1.2, gain = 0.14): void {
  const { ctx, dest } = ic;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0006, time + duration);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(Math.min(5000, freq * 8), time);
  filt.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.4), time + 0.4);
  filt.Q.value = 0.9;
  filt.connect(env).connect(dest);

  const o1 = ctx.createOscillator();
  o1.type = 'triangle'; o1.frequency.setValueAtTime(freq, time);
  const o2 = ctx.createOscillator();
  o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2, time);
  const o2g = ctx.createGain(); o2g.gain.value = 0.35;
  o1.connect(filt); o2.connect(o2g).connect(filt);
  o1.start(time); o2.start(time);
  o1.stop(time + duration + 0.05); o2.stop(time + duration + 0.05);
}

/** Glissando de harpa — varredura ascendente/descendente rápida de notas. */
export function harpGliss(
  ic: InstrumentCtx, freqs: number[], time: number, stepSec = 0.045, gain = 0.12,
): void {
  freqs.forEach((f, i) => harp(ic, f, time + i * stepSec, 1.0, gain));
}

/** Tabor — tambor de moldura da dança. Corpo com pitch-drop (180→85Hz em 70ms)
 *  + "thwack" de ruído curto na pele. */
export function tabor(ic: InstrumentCtx, time: number, gain = 0.4): void {
  const { ctx, dest } = ic;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.exponentialRampToValueAtTime(85, time + 0.07);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.001);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
  osc.connect(env).connect(dest);
  osc.start(time); osc.stop(time + 0.16);
  // Thwack da pele.
  drumHat(ic, time, gain * 0.4, 0.02);
}

/** Bodhrán — tambor irlandês de moldura, tom variável (tone 0..1: grave→agudo). */
export function bodhran(ic: InstrumentCtx, time: number, gain = 0.35, tone = 0.5): void {
  const { ctx, dest } = ic;
  const startF = 110 + tone * 130;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(startF * 0.55, time + 0.09);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  osc.connect(env).connect(dest);
  osc.start(time); osc.stop(time + 0.21);

  const bufSize = Math.max(1, Math.floor(ctx.sampleRate * 0.03));
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700 + tone * 1300;
  bp.Q.value = 0.9;
  const nEnv = ctx.createGain();
  nEnv.gain.setValueAtTime(gain * 0.5, time);
  nEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  src.connect(bp).connect(nEnv).connect(dest);
  src.start(time); src.stop(time + 0.05);
}

/** Nakers — timbales/kettledrums pareados, afinados. Fundamental senoidal +
 *  parciais quase-harmônicos (1.5, 2.1) + "ping" (pitch blip +8% em 20ms). */
export function nakers(ic: InstrumentCtx, freq: number, time: number, gain = 0.4): void {
  const { ctx, dest } = ic;
  const partials = [1, 1.5, 2.1];
  const amps = [1, 0.3, 0.18];
  for (let i = 0; i < partials.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = freq * partials[i]!;
    osc.frequency.setValueAtTime(f * 1.08, time);              // ping
    osc.frequency.exponentialRampToValueAtTime(f, time + 0.02);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * amps[i]!, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.4 - i * 0.08);
    osc.connect(env).connect(dest);
    osc.start(time);
    osc.stop(time + 0.5);
  }
}

/** Sino de igreja — síntese ADITIVA com parciais INARMÔNICOS (a tierce 1.2 é o
 *  que faz soar "sino"). Ratios 0.5/1/1.2/1.5/2/3/4; parciais altos decaem mais
 *  rápido (espectro que evolui = "shimmer→drone"). + clique de badalo. */
export function churchBell(ic: InstrumentCtx, freq: number, time: number, duration = 4, gain = 0.16): void {
  const { ctx, dest } = ic;
  const ratios = [0.5, 1, 1.2, 1.5, 2, 3, 4];
  const amps   = [0.6, 1.0, 0.8, 0.5, 0.7, 0.3, 0.2];
  const decayMul = [1.0, 1.0, 0.7, 0.6, 0.4, 0.25, 0.18];
  for (let i = 0; i < ratios.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratios[i]!, time);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * amps[i]!, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0004, time + duration * decayMul[i]!);
    osc.connect(env).connect(dest);
    osc.start(time);
    osc.stop(time + duration * decayMul[i]! + 0.1);
  }
  // Clique de badalo (broadband curto).
  drumHat(ic, time, gain * 0.3, 0.004);
}

/** Buzz do "chien" do hurdy-gurdy — transiente curto e brilhante no acento
 *  rítmico (ruído bandpass ~2.2kHz, ~30ms). É a assinatura do instrumento. */
export function hurdyBuzz(ic: InstrumentCtx, time: number, gain = 0.12): void {
  const { ctx, dest } = ic;
  const bufSize = Math.max(1, Math.floor(ctx.sampleRate * 0.035));
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 3;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.001);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  src.connect(bp).connect(env).connect(dest);
  src.start(time); src.stop(time + 0.05);
}

// ── Ornamentos — operam sobre QUALQUER MelodicVoice ──────────────────────────

/** Apojatura/grace note — nota curtíssima de aproximação antes da principal. */
export function graceNote(
  voice: MelodicVoice, ic: InstrumentCtx,
  graceFreq: number, mainFreq: number, time: number, mainDur = 0.6, gain = 0.16,
): void {
  voice(ic, graceFreq, time, 0.06, gain * 0.7);
  voice(ic, mainFreq, time + 0.05, mainDur, gain);
}

/** Trinado — alterna rapidamente entre duas notas pela duração total. */
export function trill(
  voice: MelodicVoice, ic: InstrumentCtx,
  freqA: number, freqB: number, time: number, totalDur = 0.6, gain = 0.14, rate = 0.07,
): void {
  let t = time; let useA = true;
  while (t < time + totalDur - 1e-6) {
    voice(ic, useA ? freqA : freqB, t, rate * 1.4, gain);
    useA = !useA;
    t += rate;
  }
}

/** Mordente — principal→auxiliar→principal, bem rápido, antes do sustain. */
export function mordent(
  voice: MelodicVoice, ic: InstrumentCtx,
  mainFreq: number, auxFreq: number, time: number, mainDur = 0.5, gain = 0.15,
): void {
  voice(ic, mainFreq, time, 0.07, gain);
  voice(ic, auxFreq, time + 0.06, 0.07, gain * 0.85);
  voice(ic, mainFreq, time + 0.12, mainDur, gain);
}
