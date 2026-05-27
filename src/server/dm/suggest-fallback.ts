// Fallback de suggested_actions: garante chips contextuais SEMPRE visíveis,
// mesmo quando o LLM esquece de chamar a tool suggest_actions.
//
// Estratégia: depois de processar tools, se state.suggestedActions estiver vazio,
// derivamos chips de:
//   - Combat ativo → chips por inimigo vivo (Atacar X, Aproximar de X)
//                  + tactical genéricos (Esquivar, Recuar)
//   - Exploration  → chips genéricos seguros (Explorar mais, Observar, Falar)
//                  + se NPC presente: Falar com [npc.name]
//                  + se openShop: skip (modal já abre)
//
// Princípio: chips fallback nunca substituem chips reais do DM — só preenchem
// o vazio. Player nunca fica sem opções no UI.

import type { CampaignState, SuggestedAction } from '../../shared/types.js';

/** Gera chips fallback baseado em state.
 *  Retorna [] se chips reais já existem ou se o contexto não pede chips (ex: shop modal aberto). */
export function generateFallbackChips(state: CampaignState): SuggestedAction[] {
  // Já tem chips reais do DM — não sobrescreve
  if ((state.suggestedActions ?? []).length > 0) return [];

  // Shop aberto: modal cobre interação, chips desnecessários
  if (state.openShop) return [];

  // Combat ativo: chips tactical por inimigo
  if (state.combat?.active) {
    return combatFallback(state);
  }

  // Exploration: chips genéricos seguros
  return explorationFallback(state);
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

function explorationFallback(_state: CampaignState): SuggestedAction[] {
  // Chips genéricos sempre úteis em exploração
  return [
    {
      label: 'Observar arredores',
      action: 'explore',
      details: 'olhar com atenção pra detalhes do ambiente',
      hint: 'Percepção',
    },
    {
      label: 'Investigar de perto',
      action: 'investigate',
      details: 'examinar tudo com cuidado, procurar pistas',
      hint: 'Investigação',
    },
    {
      label: 'Seguir em frente',
      action: 'explore',
      details: 'continuar avançando pelo caminho atual',
    },
    {
      label: 'Falar com quem está perto',
      action: 'talk',
      details: 'iniciar conversa com NPC visível ou tentar chamar atenção',
    },
  ];
}
