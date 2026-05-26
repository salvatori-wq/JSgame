// JSgame · F20 — Highlight reel. Mestre marca momentos memoráveis via tool.
// Lista persistente por user, mostrada na home/profile como "Melhores momentos".

import { getDbClient } from './persistence.js';
import { uuid } from './util.js';

export type HighlightKind = 'moment' | 'kill' | 'speech' | 'choice' | 'twist';

export interface Highlight {
  id: string;
  userId: string | null;
  campaignId: string;
  characterId: string | null;
  characterName: string | null;
  summary: string;
  kind: HighlightKind;
  createdAt: number;
}

export async function saveHighlight(input: {
  userId?: string | null;
  campaignId: string;
  characterId?: string | null;
  characterName?: string | null;
  summary: string;
  kind?: HighlightKind;
}): Promise<Highlight> {
  const h: Highlight = {
    id: uuid(),
    userId: input.userId ?? null,
    campaignId: input.campaignId,
    characterId: input.characterId ?? null,
    characterName: input.characterName ?? null,
    summary: input.summary,
    kind: input.kind ?? 'moment',
    createdAt: Date.now(),
  };
  await getDbClient().execute({
    sql: `INSERT INTO highlights (id, user_id, campaign_id, character_id, character_name, summary, kind, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [h.id, h.userId, h.campaignId, h.characterId, h.characterName, h.summary, h.kind, h.createdAt],
  });
  return h;
}

export async function listHighlightsForUser(userId: string, limit = 50): Promise<Highlight[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM highlights WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit],
  });
  return r.rows.map(rowToHighlight);
}

export async function listHighlightsForCampaign(campaignId: string, limit = 50): Promise<Highlight[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM highlights WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [campaignId, limit],
  });
  return r.rows.map(rowToHighlight);
}

function rowToHighlight(row: Record<string, unknown>): Highlight {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    campaignId: String(row.campaign_id),
    characterId: row.character_id ? String(row.character_id) : null,
    characterName: row.character_name ? String(row.character_name) : null,
    summary: String(row.summary),
    kind: (row.kind as HighlightKind) ?? 'moment',
    createdAt: Number(row.created_at),
  };
}

// 3A — Gera HTML standalone com timeline de highlights da campanha.
// Output: string HTML compreta (CSS inline). Funciona offline em mobile/desktop.
// Compartilhável: salvar como .html e mandar via WhatsApp/email.
const HL_KIND_ICONS: Record<HighlightKind, string> = {
  moment: '✦',
  kill: '⚔',
  speech: '💬',
  choice: '⚖',
  twist: '🌀',
};
const HL_KIND_LABELS: Record<HighlightKind, string> = {
  moment: 'Momento',
  kill: 'Combate',
  speech: 'Fala',
  choice: 'Escolha',
  twist: 'Reviravolta',
};

function escapeHtmlForExport(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHlDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

export async function generateHighlightsHtml(campaignId: string, opts?: { campaignName?: string }): Promise<string> {
  const items = await listHighlightsForCampaign(campaignId, 100);
  const campaignName = opts?.campaignName ?? 'Crônica';
  const safeCampaignName = escapeHtmlForExport(campaignName);
  // Order cronológica (oldest first pra ler como linha do tempo)
  items.reverse();

  const cards = items.length === 0
    ? '<div class="hl-empty">Nenhum momento marcado ainda. O Mestre marca highlights via mark_highlight quando algo épico acontece.</div>'
    : items.map((h) => `
        <div class="hl-card hl-${h.kind}">
          <div class="hl-card-head">
            <span class="hl-icon">${HL_KIND_ICONS[h.kind]}</span>
            <span class="hl-kind">${HL_KIND_LABELS[h.kind]}</span>
            <span class="hl-when">${formatHlDate(h.createdAt)}</span>
          </div>
          ${h.characterName ? `<div class="hl-pj">${escapeHtmlForExport(h.characterName)}</div>` : ''}
          <div class="hl-summary">${escapeHtmlForExport(h.summary)}</div>
        </div>
      `).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${safeCampaignName} — Highlight Reel</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: linear-gradient(180deg, #0c0a18 0%, #1a0e2a 100%);
  color: #e8d8b8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  line-height: 1.5;
}
.hl-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 18px 60px;
}
.hl-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(200, 168, 255, 0.2);
}
.hl-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #ffd870;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.hl-header .hl-subtitle {
  font-size: 13px;
  color: #a08868;
  font-style: italic;
}
.hl-count {
  display: inline-block;
  margin-top: 10px;
  padding: 4px 12px;
  background: rgba(120, 80, 200, 0.25);
  border: 1px solid rgba(180, 140, 240, 0.4);
  border-radius: 12px;
  font-size: 12px;
  color: #c8a8ff;
}
.hl-timeline { display: flex; flex-direction: column; gap: 14px; }
.hl-card {
  background: linear-gradient(180deg, rgba(40, 30, 60, 0.55), rgba(25, 15, 45, 0.65));
  border-left: 3px solid #c8a8ff;
  border-radius: 4px;
  padding: 14px 16px;
}
.hl-card.hl-kill   { border-left-color: #ff7050; }
.hl-card.hl-speech { border-left-color: #80c8ff; }
.hl-card.hl-choice { border-left-color: #ffb060; }
.hl-card.hl-twist  { border-left-color: #ff80f0; }
.hl-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  color: #a08868;
}
.hl-icon { font-size: 16px; }
.hl-kind {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}
.hl-when { margin-left: auto; opacity: 0.7; }
.hl-pj {
  font-size: 12px;
  color: #ffd870;
  margin-bottom: 4px;
  font-weight: 600;
}
.hl-summary {
  font-size: 14px;
  color: #e8d8b8;
}
.hl-empty {
  text-align: center;
  padding: 40px 20px;
  color: #888;
  font-style: italic;
}
.hl-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(200, 168, 255, 0.15);
  text-align: center;
  font-size: 11px;
  color: #888;
}
.hl-footer a { color: #c8a8ff; text-decoration: none; }
@media (max-width: 480px) {
  .hl-wrap { padding: 20px 12px 40px; }
  .hl-header h1 { font-size: 20px; }
  .hl-summary { font-size: 13px; }
}
</style>
</head>
<body>
<div class="hl-wrap">
  <header class="hl-header">
    <h1>${safeCampaignName}</h1>
    <div class="hl-subtitle">Os momentos que merecem ser lembrados</div>
    <div class="hl-count">${items.length} highlight${items.length === 1 ? '' : 's'}</div>
  </header>
  <main class="hl-timeline">
    ${cards}
  </main>
  <footer class="hl-footer">
    JSgame · D&amp;D coop com Mestre IA · gerado em ${formatHlDate(Date.now())}
  </footer>
</div>
</body>
</html>`;
}
