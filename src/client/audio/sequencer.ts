// Trilha Medieval — Sequencer com lookAhead scheduling.
// Pattern de Chris Wilson (https://www.html5rocks.com/en/tutorials/audio/scheduling/):
// setInterval acordando a cada 100ms, agenda notas até `nextTickT + scheduleAheadTime`.
// Resultado: timing musical sample-accurate apesar do setInterval ser jittery.
//
// Cada "step" do pattern é 1/16 de compasso. Compasso 6/8 medieval = 6 steps de 1/8
// ou 12 steps de 1/16. tempo controla BPM (default 90 — pace marcial medieval).

export interface SequencerStep {
  /** Step index dentro do pattern (0-based). */
  step: number;
  /** Tempo absoluto AudioContext.currentTime onde tocar. */
  time: number;
}

export interface SequencerOpts {
  ctx: AudioContext;
  /** BPM (beats per minute). 60-160. */
  bpm: number;
  /** Quantos steps tem o pattern total. Loop a cada N steps. */
  patternLength: number;
  /** Subdivisão: quantos steps por tempo (4 = colcheias, 2 = semínimas, 8 = semicolcheias). */
  stepsPerBeat?: number;
  /** Callback chamado pra cada step a agendar — desenhe instrumentos aqui. */
  onStep: (s: SequencerStep) => void;
}

export class Sequencer {
  private opts: Required<SequencerOpts>;
  private nextStepIdx = 0;
  private nextNoteT = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** Lookahead em segundos — agenda notas até este window à frente. */
  private static readonly SCHEDULE_AHEAD = 0.15;
  /** Frequência do scheduler em ms — 25ms = 40Hz de check, suficiente pra cobrir lookahead. */
  private static readonly LOOKAHEAD_MS = 25;

  constructor(opts: SequencerOpts) {
    this.opts = { stepsPerBeat: 4, ...opts };
  }

  /** Duração em segundos de cada step. */
  private stepDuration(): number {
    return 60 / this.opts.bpm / this.opts.stepsPerBeat;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.nextNoteT = this.opts.ctx.currentTime + 0.05;
    this.nextStepIdx = 0;
    this.tick();
    this.intervalId = setInterval(() => this.tick(), Sequencer.LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private tick(): void {
    const ctx = this.opts.ctx;
    while (this.nextNoteT < ctx.currentTime + Sequencer.SCHEDULE_AHEAD) {
      this.opts.onStep({ step: this.nextStepIdx, time: this.nextNoteT });
      this.nextNoteT += this.stepDuration();
      this.nextStepIdx = (this.nextStepIdx + 1) % this.opts.patternLength;
    }
  }
}
