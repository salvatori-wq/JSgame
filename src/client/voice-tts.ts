// JSgame · C3 — Voice TTS narrações DM via Web Speech API.
// 100% browser nativo. Sem custo. PT-BR variant. Toggle persistente em localStorage.

const STORAGE_KEY = 'jsgame.voice-tts.enabled';
const PT_BR_LOCALES = ['pt-BR', 'pt_BR', 'pt-PT', 'pt'];

let enabled = false;
let initialized = false;
let preferredVoice: SpeechSynthesisVoice | null = null;

export function isVoiceTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isVoiceTtsEnabled(): boolean {
  if (!initialized) initialize();
  return enabled;
}

export function setVoiceTtsEnabled(v: boolean): void {
  enabled = v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch { /* noop */ }
  if (!v) cancelSpeech();
}

function initialize(): void {
  initialized = true;
  if (!isVoiceTtsSupported()) return;
  try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* noop */ }
  pickPtBrVoice();
  // voiceschanged dispara assíncrono em alguns browsers
  window.speechSynthesis.onvoiceschanged = () => pickPtBrVoice();
}

function pickPtBrVoice(): void {
  if (!isVoiceTtsSupported()) return;
  const voices = window.speechSynthesis.getVoices();
  preferredVoice = voices.find((v) => PT_BR_LOCALES.includes(v.lang)) ?? null;
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): void {
  if (!initialized) initialize();
  if (!enabled || !isVoiceTtsSupported()) return;
  // Cancela fala anterior se ainda rolando (evita acúmulo).
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  const utt = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utt.voice = preferredVoice;
  utt.lang = preferredVoice?.lang ?? 'pt-BR';
  utt.rate = opts.rate ?? 1.0;
  utt.pitch = opts.pitch ?? 1.0;
  window.speechSynthesis.speak(utt);
}

export function cancelSpeech(): void {
  if (!isVoiceTtsSupported()) return;
  window.speechSynthesis.cancel();
}
