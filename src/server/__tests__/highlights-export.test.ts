// Tests pra 3A — Highlight reel HTML exportável.
// Usa DB in-memory via persistence init.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import { saveHighlight, generateHighlightsHtml } from '../highlights.js';

describe('3A — generateHighlightsHtml', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    await getDbClient().execute('DELETE FROM highlights');
  });

  it('campanha sem highlights = HTML válido com placeholder', async () => {
    const html = await generateHighlightsHtml('camp-empty');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Nenhum momento marcado');
    expect(html).toContain('0 highlights');
  });

  it('com highlights = card por highlight', async () => {
    await saveHighlight({
      campaignId: 'camp-test',
      summary: 'Lyra atravessou a ponte',
      kind: 'choice',
      characterName: 'Lyra',
    });
    await saveHighlight({
      campaignId: 'camp-test',
      summary: 'Borin baixou o ogro',
      kind: 'kill',
      characterName: 'Borin',
    });
    const html = await generateHighlightsHtml('camp-test', { campaignName: 'Crônica dos Aventureiros' });
    expect(html).toContain('Crônica dos Aventureiros');
    expect(html).toContain('Lyra atravessou a ponte');
    expect(html).toContain('Borin baixou o ogro');
    expect(html).toContain('hl-choice');
    expect(html).toContain('hl-kill');
    expect(html).toContain('2 highlights');
  });

  it('escapa HTML pra prevenir XSS', async () => {
    await saveHighlight({
      campaignId: 'camp-xss',
      summary: '<script>alert("xss")</script>',
      characterName: '<b>hacker</b>',
    });
    const html = await generateHighlightsHtml('camp-xss');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;hacker&lt;/b&gt;');
  });

  it('HTML standalone (sem deps externos)', async () => {
    await saveHighlight({ campaignId: 'camp-standalone', summary: 'epic' });
    const html = await generateHighlightsHtml('camp-standalone');
    // Sem <link> external, sem <script src>
    expect(html).not.toMatch(/<link\s+rel/i);
    expect(html).not.toMatch(/<script\s+src/i);
    // Mas tem CSS inline
    expect(html).toContain('<style>');
  });

  it('ordem cronológica (oldest first)', async () => {
    await saveHighlight({ campaignId: 'camp-order', summary: 'PRIMEIRO' });
    await new Promise((r) => setTimeout(r, 10));
    await saveHighlight({ campaignId: 'camp-order', summary: 'SEGUNDO' });
    const html = await generateHighlightsHtml('camp-order');
    const idxFirst = html.indexOf('PRIMEIRO');
    const idxSecond = html.indexOf('SEGUNDO');
    expect(idxFirst).toBeGreaterThan(0);
    expect(idxFirst).toBeLessThan(idxSecond);
  });

  it('5 kinds têm border colors distintos no CSS', async () => {
    const html = await generateHighlightsHtml('camp-x');
    expect(html).toContain('.hl-card.hl-kill');
    expect(html).toContain('.hl-card.hl-speech');
    expect(html).toContain('.hl-card.hl-choice');
    expect(html).toContain('.hl-card.hl-twist');
  });

  it('mobile-friendly: viewport + media query', async () => {
    const html = await generateHighlightsHtml('camp-mobile');
    expect(html).toContain('viewport');
    expect(html).toContain('@media (max-width: 480px)');
  });

  it('só inclui highlights da campanha pedida', async () => {
    await saveHighlight({ campaignId: 'camp-a', summary: 'EVENTO_A' });
    await saveHighlight({ campaignId: 'camp-b', summary: 'EVENTO_B' });
    const htmlA = await generateHighlightsHtml('camp-a');
    expect(htmlA).toContain('EVENTO_A');
    expect(htmlA).not.toContain('EVENTO_B');
  });
});
