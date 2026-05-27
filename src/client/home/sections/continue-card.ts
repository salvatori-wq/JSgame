// JSgame · Ω.2 — Continue Card.
// Quando lastSession existe + crônica ativa, mostra card DESTAQUE #1 acima
// das prefabs. Preview rico (location + última narração + risco).
// Tap → navega direto pra campaign (sem fricção).

import { el } from '../../util';
import { listCampaigns, type CampaignSummary } from '../../api';
import { getLastSession } from '../../util';

export interface ContinueCardOpts {
  onContinue: (chronicle: { characterId: string; campaignId: string }) => void;
}

/** Retorna o card OU null se não há sessão ativa pra mostrar. Async porque busca
 * preview rico via listCampaigns. Renderização do skeleton enquanto carrega. */
export async function maybeRenderContinueCard(opts: ContinueCardOpts): Promise<HTMLElement | null> {
  const last = getLastSession();
  if (!last) return null;

  // Skeleton inicial — substituído quando fetch volta
  const card = el('section', { class: 'home-continue', attrs: { role: 'region', 'aria-label': 'Continuar campanha ativa' } });
  card.appendChild(el('div', { class: 'home-continue-skeleton' }, [
    el('div', { class: 'skeleton skeleton-line skeleton-line-short' }),
    el('div', { class: 'skeleton skeleton-line' }),
    el('div', { class: 'skeleton skeleton-line skeleton-line-long' }),
  ]));

  // Async populate
  void (async () => {
    let summary: CampaignSummary | null = null;
    try {
      const camps = await listCampaigns();
      summary = camps.find((c) => c.id === last.campaignId) ?? null;
    } catch { /* silent */ }

    card.innerHTML = '';

    if (!summary) {
      // Sessão referenciada não existe mais — mostra fallback simples ainda assim
      // (pra não esconder card e perder a CTA).
      card.appendChild(buildCardContent({
        title: '🌒 Continuar de onde parou',
        meta: 'Sessão salva localmente',
        location: null,
        preview: 'Clique pra retomar a crônica.',
        atRisk: false,
        riskName: null,
        onContinue: () => opts.onContinue({ characterId: last.characterId, campaignId: last.campaignId }),
      }));
      return;
    }

    card.appendChild(buildCardContent({
      title: summary.name || '🌒 Continuar de onde parou',
      meta: `Sessão ${summary.sessionNumber} · ${formatRelativeTime(summary.lastPlayedAt)}`,
      location: summary.currentLocation ?? null,
      preview: summary.lastNarrationSnippet ?? null,
      atRisk: !!summary.partyAnyAtRisk,
      riskName: summary.partyAtRiskName ?? null,
      onContinue: () => opts.onContinue({ characterId: last.characterId, campaignId: summary!.id }),
    }));
  })();

  return card;
}

interface ContinueContent {
  title: string;
  meta: string;
  location: string | null;
  preview: string | null;
  atRisk: boolean;
  riskName: string | null;
  onContinue: () => void;
}

function buildCardContent(c: ContinueContent): HTMLElement {
  const wrap = el('div', { class: `home-continue-inner ${c.atRisk ? 'is-risk' : ''}` });

  wrap.appendChild(el('div', { class: 'home-continue-eyebrow', text: 'CONTINUE DE ONDE PAROU' }));
  wrap.appendChild(el('div', { class: 'home-continue-title', text: c.title }));
  wrap.appendChild(el('div', { class: 'home-continue-meta', text: c.meta }));

  if (c.location) {
    wrap.appendChild(el('div', { class: 'home-continue-location', text: `📍 ${c.location}` }));
  }
  if (c.preview) {
    wrap.appendChild(el('div', { class: 'home-continue-preview', text: `"${c.preview}"` }));
  }
  if (c.atRisk) {
    wrap.appendChild(el('div', { class: 'home-continue-risk', text: `⚠ ${c.riskName ?? 'Aliado'} em risco` }));
  }

  wrap.appendChild(el('button', {
    class: 'home-continue-cta cta-glow',
    text: '▶ CONTINUAR',
    attrs: { type: 'button', 'aria-label': `Continuar ${c.title}` },
    on: { click: c.onContinue },
  }));

  return wrap;
}

function formatRelativeTime(iso: string | number): string {
  const ts = typeof iso === 'string' ? Date.parse(iso) : iso;
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d atrás`;
  return new Date(ts).toLocaleDateString();
}
