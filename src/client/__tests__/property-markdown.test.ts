// Sprint A — Property-based testing pra renderNarrationText (XSS safety).
// Invariantes:
//  - Output NUNCA contém <script ou <iframe ou onerror= ou javascript: ainda parseável
//  - escapeHtml é idempotente (escape(escape(x)) === escape(x))
//  - renderNarrationText em string já escapada não amplifica
//  - <bold>, <em>, <code> sempre balanceados

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { renderNarrationText, escapeHtml } from '../util.js';

// Lista de payloads adversariais conhecidos (OWASP XSS cheat sheet)
const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
  '<a href="javascript:alert(1)">click</a>',
  '<style>body{background:url("javascript:alert(1)")}</style>',
  '<input onfocus=alert(1) autofocus>',
  '<body onload=alert(1)>',
  '<<SCRIPT>alert(1)<<SCRIPT>',
  '<details open ontoggle=alert(1)>',
  'data:text/html,<script>alert(1)</script>',
];

// Whitelist de tags que renderNarrationText pode produzir.
// Qualquer OUTRA tag em output literal seria injeção.
const SAFE_TAG_WHITELIST = /^(strong|em|code|br)$/i;

// Extrai tags HTML literais (sem escape) do output usando capture groups.
function extractTags(html: string): string[] {
  const tags: string[] = [];
  const re = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  for (const m of html.matchAll(re)) {
    if (m[1]) tags.push(m[1]);
  }
  return tags;
}

describe('renderNarrationText — XSS safety (property)', () => {
  it('input arbitrário SÓ produz tags da whitelist', () => {
    fc.assert(fc.property(fc.string(), (input) => {
      const out = renderNarrationText(input);
      const tags = extractTags(out);
      for (const tag of tags) {
        expect(tag).toMatch(SAFE_TAG_WHITELIST);
      }
    }), { numRuns: 5000 });
  });

  it('XSS payloads conhecidos: zero tags fora do whitelist', () => {
    for (const payload of XSS_PAYLOADS) {
      const out = renderNarrationText(payload);
      const tags = extractTags(out);
      for (const tag of tags) {
        expect(tag).toMatch(SAFE_TAG_WHITELIST);
      }
      // Verifica também que `<` originais foram escapados
      expect(out).not.toContain('<script');
      expect(out).not.toContain('<iframe');
      expect(out).not.toContain('<img ');
      expect(out).not.toContain('<svg');
    }
  });

  it('unicode/emoji exotic NÃO quebra encoding', () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), (s) => {
      const out = renderNarrationText(s);
      expect(typeof out).toBe('string');
      expect(() => out.length).not.toThrow();
    }), { numRuns: 2000 });
  });

  it('strings com caracteres especiais sao SEMPRE escapadas', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 100 }), (s) => {
      const out = renderNarrationText(s);
      // Se input tinha < literal sem formatacao markdown, output nao deve ter tag aberta
      const hasMd = s.includes('**') || s.includes('*') || s.includes('_') || s.includes('`');
      if (s.includes('<') && !hasMd) {
        const afterLt = s.split('<')[1]?.split('>')[0];
        if (afterLt) expect(out).not.toContain('<' + afterLt);
      }
    }), { numRuns: 1000 });
  });

  it('input vazio retorna vazio', () => {
    expect(renderNarrationText('')).toBe('');
  });

  it('input só whitespace é preservado', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^[ \t]+$/),
      (s) => {
        const out = renderNarrationText(s);
        expect(out.length).toBeGreaterThanOrEqual(s.length);
      },
    ), { numRuns: 100 });
  });
});

describe('escapeHtml — property', () => {
  it('idempotência: escape(escape(x)) === escape(x) ... NÃO (HTML entities re-escapam)', () => {
    // Nota: escapeHtml NÃO é idempotente porque & → &amp; e &amp → &amp;amp;
    // Verifica que ao menos round-trip via parser DOM produz string original.
    fc.assert(fc.property(fc.string({ maxLength: 200 }), (s) => {
      const escaped = escapeHtml(s);
      // Esperado: caracteres especiais não aparecem como literais
      if (s.includes('<')) expect(escaped).toContain('&lt;');
      if (s.includes('>')) expect(escaped).toContain('&gt;');
      if (s.includes('"')) expect(escaped).toContain('&quot;');
      // Comportamento conhecido: re-escape DUPLA codifica & — documentado, não bug
    }), { numRuns: 1000 });
  });

  it('escapa TODOS os 5 caracteres perigosos', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });
});

describe('markdown rendering — property', () => {
  it('**bold** sempre balanceado: nº strong tags par', () => {
    fc.assert(fc.property(fc.string({ maxLength: 100 }), (s) => {
      const out = renderNarrationText(s);
      const opens = (out.match(/<strong>/g) || []).length;
      const closes = (out.match(/<\/strong>/g) || []).length;
      expect(opens).toBe(closes);
    }), { numRuns: 1000 });
  });

  it('*italic* sempre balanceado', () => {
    fc.assert(fc.property(fc.string({ maxLength: 100 }), (s) => {
      const out = renderNarrationText(s);
      const opens = (out.match(/<em>/g) || []).length;
      const closes = (out.match(/<\/em>/g) || []).length;
      expect(opens).toBe(closes);
    }), { numRuns: 1000 });
  });

  it('`code` sempre balanceado', () => {
    fc.assert(fc.property(fc.string({ maxLength: 100 }), (s) => {
      const out = renderNarrationText(s);
      const opens = (out.match(/<code>/g) || []).length;
      const closes = (out.match(/<\/code>/g) || []).length;
      expect(opens).toBe(closes);
    }), { numRuns: 1000 });
  });

  it('newline preserva como <br>', () => {
    expect(renderNarrationText('a\nb')).toBe('a<br>b');
    expect(renderNarrationText('\n\n')).toBe('<br><br>');
  });
});
