// Fallback de suggested_actions: garante chips contextuais SEMPRE visíveis,
// mesmo quando o LLM esquece de chamar a tool suggest_actions.
//
// Estratégia: depois de processar tools, se state.suggestedActions estiver vazio,
// derivamos chips de:
//   - Combat ativo → chips por inimigo vivo (Atacar X, Aproximar de X)
//                  + tactical genéricos (Esquivar, Recuar)
//   - Exploration  → SMART: parse última narração pra extrair NPCs/landmarks
//                  e gerar chips contextuais ("Falar com guarda", "Investigar baú")
//                  + completa com genéricos só se sobrar espaço
//   - openShop ativo → skip (modal cobre)
//
// Princípio: chips fallback nunca substituem chips reais do DM — só preenchem
// o vazio. Player nunca fica sem opções no UI.

import type { CampaignState, SuggestedAction } from '../../shared/types.js';
import { extractNarrationEntities } from './narration-entities.js';

/** Gera chips fallback baseado em state.
 *  @param lastNarration última narração do Mestre (opcional). Se passada, chips
 *                       exploration ficam CONTEXTUAIS (NPCs/landmarks da cena).
 *  Retorna [] se chips reais já existem ou se o contexto não pede chips (ex: shop modal aberto). */
export function generateFallbackChips(
  state: CampaignState,
  lastNarration?: string,
): SuggestedAction[] {
  // Já tem chips reais do DM — não sobrescreve
  if ((state.suggestedActions ?? []).length > 0) return [];

  // Shop aberto: modal cobre interação, chips desnecessários
  if (state.openShop) return [];

  // Combat ativo: chips tactical por inimigo
  if (state.combat?.active) {
    return combatFallback(state);
  }

  // Exploration: SMART contextual se tiver narração, senão genéricos
  return explorationFallback(state, lastNarration);
}

function combatFallback(state: CampaignState): SuggestedAction[] {
  const enemies = (state.combat?.enemies ?? []).filter((e) => e.currentHp > 0);
  const chips: SuggestedAction[] = [];

  // Até 2 chips de ataque por inimigo (top 2 mais ameaçadores: boss primeiro, depois HP alto)
  const sorted = [...enemies].sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
    return b.currentHp - a.currentHp;
  }).slice(0, 2);

  for (const e of sorted) {
    chips.push({
      label: `Atacar ${e.name}`,
      action: 'attack',
      details: `atacar ${e.name}`,
      hint: e.isBoss ? 'Chefe' : undefined,
    });
  }

  // Sempre adiciona aproximar/afastar genéricos se há inimigos
  if (enemies.length > 0) {
    const target = sorted[0]!;
    chips.push({
      label: `Aproximar de ${target.name}`,
      action: 'custom',
      details: `aproximar de ${target.name} pra atacar corpo a corpo`,
      hint: 'Movimento',
    });
  }

  // Tactical genérico — esquivar
  if (chips.length < 4) {
    chips.push({
      label: 'Esquivar e observar',
      action: 'custom',
      details: 'usar ação Esquivar (Dodge) e analisar o campo',
      hint: 'Defesa',
    });
  }

  return chips.slice(0, 4);
}

function explorationFallback(
  _state: CampaignState,
  lastNarration?: string,
): SuggestedAction[] {
  const chips: SuggestedAction[] = [];

  // Smart: extrai NPCs/landmarks da última narração
  if (lastNarration && lastNarration.trim().length > 0) {
    const { npcs, landmarks } = extractNarrationEntities(lastNarration);

    // Chip por NPC visível (até 2)
    for (const npc of npcs.slice(0, 2)) {
      // Capitalize primeira letra se vier lowercase (NPC por papel)
      const label = npc[0] === npc[0]!.toUpperCase()
        ? `Falar com ${npc}`
        : `Falar com o ${npc}`;
      chips.push({
        label,
        action: 'talk',
        details: `iniciar conversa com ${npc}, ler intenção, fazer pergunta direta`,
      });
    }

    // Chip por landmark (até 2)
    for (const landmark of landmarks.slice(0, 2)) {
      chips.push({
        label: `Investigar ${landmark}`,
        action: 'investigate',
        details: `examinar ${landmark} de perto, procurar detalhes ou mecanismos`,
        hint: 'Investigação',
      });
    }
  }

  // Completa com genéricos pra atingir 4 chips
  const generic: SuggestedAction[] = [
    {
      label: 'Observar arredores',
      action: 'explore',
      details: 'olhar com atenção pra detalhes do ambiente',
      hint: 'Percepção',
    },
    {
      label: 'Seguir em frente',
      action: 'explore',
      details: 'continuar avançando pelo caminho atual',
    },
    {
      label: 'Investigar mais',
      action: 'investigate',
      details: 'procurar pistas que possam ter passado batido',
      hint: 'Investigação',
    },
    {
      label: 'Tentar passar despercebido',
      action: 'sneak',
      details: 'avançar com cautela, evitar atenção',
      hint: 'Furtividade',
    },
  ];

  const existingLabels = new Set(chips.map((c) => c.label.toLowerCase()));
  for (const g of generic) {
    if (chips.length >= 4) break;
    if (existingLabels.has(g.label.toLowerCase())) continue;
    chips.push(g);
  }

  return chips.slice(0, 4);
}
