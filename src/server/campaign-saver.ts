// Fase 0d — saver coalescido de campanha. Em vez de gravar o JSON INTEIRO do
// CampaignState no Turso a CADA acao/roll (21 call-sites), marca a cronica como
// "suja" e grava no maximo 1× a cada ~2.5s. Crucial ANTES do streaming, que
// multiplica eventos por turno → write amplification no free tier do Turso.
//
// Seguranca de dados: guarda a REF do state vivo (o flush sempre persiste a
// versao MAIS RECENTE), e ha 2 caminhos de flush imediato — disconnect do socket
// e shutdown gracioso (SIGINT/SIGTERM) — pra nao perder a ultima jogada.

import type { CampaignState } from '../shared/types.js';
import { saveCampaign } from './persistence.js';

const FLUSH_MS = 2500;

interface Pending {
  state: CampaignState; // ref pro state vivo — sempre a versao mais recente
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();

/** Agenda um save coalescido por campaignId. Fire-and-forget (nao bloqueia o turno). */
export function scheduleSaveCampaign(state: CampaignState): void {
  const id = state.id;
  const existing = pending.get(id);
  if (existing) {
    existing.state = state; // atualiza pra ultima ref; timer ja agendado = coalesce
    return;
  }
  const timer = setTimeout(() => { void flushCampaign(id); }, FLUSH_MS);
  // unref: o timer pendente nao deve segurar o processo vivo no shutdown.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }
  pending.set(id, { state, timer });
}

/** Grava AGORA a cronica pendente (await). No-op se nao ha nada pendente. */
export async function flushCampaign(id: string): Promise<void> {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  try {
    await saveCampaign(p.state);
  } catch (err) {
    console.warn('[campaign-saver] flush falhou pra', id, err);
  }
}

/** Cancela um save pendente SEM gravar (usado no delete da cronica — evita re-criar a linha). */
export function cancelScheduledSave(id: string): void {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
}

/** Grava TODAS as cronicas pendentes (shutdown gracioso). */
export async function flushAllCampaigns(): Promise<void> {
  const ids = [...pending.keys()];
  await Promise.all(ids.map((id) => flushCampaign(id)));
}

/** So pra testes — quantas cronicas estao com save pendente. */
export function _pendingSaveCount(): number {
  return pending.size;
}
