// JSgame · α.4 — Voice STT (Speech-to-Text) via Web Speech API.
// 100% browser nativo (não envia áudio pra servidor). Sem custo. PT-BR.
// Push-to-talk: usuário aperta botão, fala, solta — texto vai pro input.
//
// Browser support 2026:
//   - Chrome/Edge/Brave (desktop + Android): nativo (webkitSpeechRecognition)
//   - Firefox: NÃO suporta — fallback gracioso (esconde botão)
//   - Safari iOS 14.5+: suporta com prompt de permissão
//   - Samsung Internet: suporta

// Types pra Web Speech API (nem todos TSes têm built-in)
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionEvent extends Event {
  results: { length: number; [index: number]: SpeechRecognitionResult };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

export function isVoiceSttSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as WindowWithSpeech;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SttStatus = 'idle' | 'recording' | 'processing';

export interface SttSession {
  stop(): void;        // termina e dispara onFinal com o que conseguiu
  abort(): void;       // cancela sem disparar
}

export interface SttCallbacks {
  // Texto parcial vindo enquanto user fala (interim). Pode ser chamado várias vezes.
  onInterim?(text: string): void;
  // Texto final consolidado quando user para de falar (OU stop chamado).
  onFinal(text: string): void;
  // Erro — voice bloqueado, sem mic, sem permissão, sem rede.
  // Códigos comuns: 'no-speech', 'audio-capture', 'not-allowed', 'network', 'aborted'.
  onError?(code: string, message?: string): void;
  // Lifecycle pra UI atualizar (idle ↔ recording ↔ processing).
  onStatus?(status: SttStatus): void;
}

/**
 * Inicia escuta single-utterance.
 * Retorna SttSession com stop/abort, ou null se não suportado.
 *
 * Param continuous=false (default): para automaticamente após silêncio.
 * Pra push-to-talk com botão: use continuous=true e chame stop() ao soltar.
 */
export function startStt(cb: SttCallbacks, opts: { continuous?: boolean; interim?: boolean } = {}): SttSession | null {
  const Ctor = getCtor();
  if (!Ctor) {
    cb.onError?.('unsupported', 'SpeechRecognition não disponível neste browser');
    return null;
  }
  const rec = new Ctor();
  rec.lang = 'pt-BR';
  rec.continuous = opts.continuous ?? true;  // push-to-talk = continuous=true
  rec.interimResults = opts.interim ?? true;
  rec.maxAlternatives = 1;

  let finalText = '';
  let aborted = false;

  rec.onstart = () => cb.onStatus?.('recording');
  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (!res) continue;
      const txt = res[0]?.transcript ?? '';
      if (res.isFinal) finalText += txt;
      else interim += txt;
    }
    if (interim && cb.onInterim) cb.onInterim((finalText + interim).trim());
  };
  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    if (aborted) return; // user clicou abort — não é erro real
    cb.onError?.(ev.error, ev.message);
    cb.onStatus?.('idle');
  };
  rec.onend = () => {
    if (aborted) {
      cb.onStatus?.('idle');
      return;
    }
    cb.onStatus?.('processing');
    const finalTrim = finalText.trim();
    if (finalTrim) cb.onFinal(finalTrim);
    else cb.onError?.('no-speech', 'Não captei nada');
    cb.onStatus?.('idle');
  };

  try {
    rec.start();
  } catch (err) {
    cb.onError?.('start-failed', err instanceof Error ? err.message : String(err));
    cb.onStatus?.('idle');
    return null;
  }

  return {
    stop: () => { try { rec.stop(); } catch { /* noop */ } },
    abort: () => { aborted = true; try { rec.abort(); } catch { /* noop */ } },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (testable sem JSDOM)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Mensagem amigável pro user a partir do código de erro do SpeechRecognition.
 */
export function sttErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '🎙 Microfone bloqueado. Libera a permissão no browser e tenta de novo.';
    case 'no-speech':
      return '🔇 Não captei nada. Tenta falar mais perto do mic.';
    case 'audio-capture':
      return '🎙 Mic não encontrado. Conecta um microfone.';
    case 'network':
      return '📡 Sem rede pra reconhecimento. Tenta de novo daqui pouco.';
    case 'aborted':
      return '⏹ Gravação cancelada.';
    case 'unsupported':
      return '🚫 Browser não suporta voz. Usa Chrome/Edge/Safari.';
    default:
      return `⚠ Erro de voz: ${code}`;
  }
}

/**
 * Decide se o botão mic deve aparecer.
 * Esconde no Firefox (sem suporte) e em browsers headless.
 */
export function shouldShowVoiceMic(): boolean {
  return isVoiceSttSupported();
}
