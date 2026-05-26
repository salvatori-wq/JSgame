// QW-2 — Markdown rendering nas narrações. XSS-safety crítico.

import { describe, it, expect } from 'vitest';
import { escapeHtml, renderNarrationText } from '../util';

describe('escapeHtml', () => {
  it('escapa <, >, &, ", \'', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('renderNarrationText — QW-2 markdown', () => {
  it('escapa HTML do input (XSS guard PRIMEIRO)', () => {
    const malicious = '<script>alert("xss")</script>';
    const out = renderNarrationText(malicious);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('renderiza **bold** como <strong>', () => {
    expect(renderNarrationText('eu sou **forte** assim'))
      .toBe('eu sou <strong>forte</strong> assim');
  });

  it('renderiza *italic* como <em>', () => {
    expect(renderNarrationText('eu sou *etéreo* assim'))
      .toBe('eu sou <em>etéreo</em> assim');
  });

  it('renderiza _italic_ como <em>', () => {
    expect(renderNarrationText('eu sou _etéreo_ assim'))
      .toBe('eu sou <em>etéreo</em> assim');
  });

  it('renderiza `code` como <code>', () => {
    expect(renderNarrationText('rola um `d20`'))
      .toBe('rola um <code>d20</code>');
  });

  it('bold + italic na mesma frase — não confunde', () => {
    expect(renderNarrationText('**duro** e *suave*'))
      .toBe('<strong>duro</strong> e <em>suave</em>');
  });

  it('newline vira <br>', () => {
    expect(renderNarrationText('linha 1\nlinha 2'))
      .toBe('linha 1<br>linha 2');
  });

  it('XSS via atributo HTML — tag fica neutralizada pois `<` escapou', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const out = renderNarrationText(malicious);
    // Tag real não pode existir (precisaria `<` cru pra browser parsear)
    expect(out).not.toMatch(/<img[^&]/);  // < cru seguido de img
    // Aspas também escaparam
    expect(out).not.toContain('"alert(1)"');  // sem aspas duplas cruas
    expect(out).toContain('&lt;img');         // versão escapada visível
    expect(out).toContain('&quot;alert(1)&quot;');
  });

  it('** sem fechamento não vira bold', () => {
    expect(renderNarrationText('só ** começa'))
      .toBe('só ** começa');
  });

  it('* solto também não vira italic (sem par)', () => {
    expect(renderNarrationText('aspas * sozinha'))
      .toBe('aspas * sozinha');
  });

  it('aspas e apostrofos escapados não quebram markdown', () => {
    expect(renderNarrationText("Ele disse: 'oi' e **fugiu**"))
      .toBe('Ele disse: &#39;oi&#39; e <strong>fugiu</strong>');
  });

  it('texto longo realista do DM funciona', () => {
    const input = 'A taverna **range**. *No canto*, um vulto.';
    expect(renderNarrationText(input))
      .toBe('A taverna <strong>range</strong>. <em>No canto</em>, um vulto.');
  });
});
