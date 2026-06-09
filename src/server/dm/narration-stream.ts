// Fase 2 — extrator INCREMENTAL do campo "narration" de um JSON que chega em
// chunks (streaming). Emite só os deltas LIMPOS (un-escaped) do VALOR da
// narração, parando no fechamento da string. É best-effort: serve só pra PRÉVIA
// no client; a verdade continua sendo a resposta bufferizada + pós-processada
// (extractJson/strip/fog/retry). O `dmNarration` final SUBSTITUI a prévia.
//
// Por que existe: o system prompt manda "RESPONDA EM JSON" → o conteúdo cru é
// `{"narration":"...","speaker":"..."}`. Mandar isso cru pro client mostraria
// JSON. Aqui a gente puxa só o texto da narração, char a char, conforme cresce.

interface DecodeResult {
  /** Valor decodificado (un-escaped) até onde dá com segurança. */
  value: string;
  /** true se achou a aspa de fechamento NÃO-escapada (fim da narração). */
  closed: boolean;
}

/**
 * Decodifica o INTERIOR de uma string JSON (sem as aspas externas), parando na
 * 1ª aspa não-escapada (closed=true) ou no fim seguro do que chegou. Um escape
 * incompleto na fronteira do chunk (ex: termina em "\" ou "\u12") faz parar ANTES
 * dele — o próximo chunk completa, e nada parcial vaza.
 */
export function decodeJsonStringPartial(s: string): DecodeResult {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '"') {
      return { value: out, closed: true };
    }
    if (c === '\\') {
      if (i + 1 >= s.length) break; // escape incompleto na fronteira — para
      const n = s[i + 1]!;
      switch (n) {
        case 'n': out += '\n'; i += 2; break;
        case 't': out += '\t'; i += 2; break;
        case 'r': out += '\r'; i += 2; break;
        case 'b': out += '\b'; i += 2; break;
        case 'f': out += '\f'; i += 2; break;
        case '"': out += '"'; i += 2; break;
        case '\\': out += '\\'; i += 2; break;
        case '/': out += '/'; i += 2; break;
        case 'u': {
          // precisa de \uXXXX (4 hex). Se não chegou tudo, para e espera o resto.
          if (i + 6 > s.length) return { value: out, closed: false };
          const hex = s.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            out += n; i += 2; // \u inválido — trata literal, não trava o stream
          }
          break;
        }
        default: out += n; i += 2; break;
      }
    } else {
      out += c;
      i += 1;
    }
  }
  return { value: out, closed: false };
}

/** Quanto buffer juntar sem achar `"narration":"` antes de assumir texto-puro. */
const PLAIN_MODE_THRESHOLD = 240;

export class NarrationStreamExtractor {
  private buf = '';
  private valueStart = -1; // índice no buf onde o VALOR começa (após `"narration":"`)
  private emitted = '';    // texto limpo já emitido (append-only)
  private done = false;
  private plain = false;   // LLM não usou JSON → passa o texto cru

  /** Acumula o delta CRU e chama emit() com o(s) delta(s) LIMPO(s) da narração. */
  push(rawDelta: string, emit: (cleanDelta: string) => void): void {
    if (this.done || !rawDelta) return;
    this.buf += rawDelta;

    // Modo texto-puro: o provider não mandou JSON {narration} — streama tudo.
    if (this.plain) {
      const all = this.buf;
      if (all.length > this.emitted.length) {
        emit(all.slice(this.emitted.length));
        this.emitted = all;
      }
      return;
    }

    // Ainda procurando o início do valor da narração.
    if (this.valueStart < 0) {
      const m = this.buf.match(/"narration"\s*:\s*"/);
      if (m && m.index !== undefined) {
        this.valueStart = m.index + m[0].length;
      } else if (this.buf.length >= PLAIN_MODE_THRESHOLD && !looksLikeJsonStart(this.buf)) {
        // Texto longo e não parece JSON → assume texto-puro e streama o acumulado.
        this.plain = true;
        emit(this.buf);
        this.emitted = this.buf;
        return;
      } else {
        return; // espera mais chunks
      }
    }

    const { value, closed } = decodeJsonStringPartial(this.buf.slice(this.valueStart));
    if (value.length > this.emitted.length && value.startsWith(this.emitted)) {
      emit(value.slice(this.emitted.length));
      this.emitted = value;
    }
    if (closed) this.done = true;
  }

  /** Texto limpo emitido até agora (debug/test). */
  get text(): string { return this.emitted; }
  get finished(): boolean { return this.done; }
}

/** Heurística: o buffer parece o começo de um JSON com campo narration? */
function looksLikeJsonStart(s: string): boolean {
  const head = s.trimStart().slice(0, 60);
  return head.startsWith('{') || head.startsWith('```') || /"narration"/.test(s);
}
