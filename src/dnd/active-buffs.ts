// JSgame · Fase 2 — Helper PURO de CA efetiva (buffs mecânicos).
// Compartilhado client + server. Sem deps de runtime (nada de dice/Date) pra
// ser seguro nos dois lados. A matemática de "CA base + bônus de buffs ativos"
// vivia só no server (buff-engine.readAcBonus); agora é única e o cliente
// também mostra a CA correta quando Mage Armor / Escudo da Fé estão ativos.

import type { ActiveBuff, CharacterSheet } from '../shared/types';

/** Soma os bônus de CA do tipo flat-bonus dos buffs ativos (Mage Armor +3,
 *  Shield +5, Escudo da Fé +2, Haste +2, etc). Retorna o total + as fontes. */
export function acBonusFromBuffs(buffs: ActiveBuff[] | undefined | null): { flatBonus: number; sources: string[] } {
  const sources: string[] = [];
  let flatBonus = 0;
  if (!buffs) return { flatBonus, sources };
  for (const b of buffs) {
    if (b.appliesTo !== 'ac') continue;
    if (b.effect.kind === 'flat-bonus') {
      flatBonus += b.effect.value;
      sources.push(b.source);
    }
  }
  return { flatBonus, sources };
}

/** CA efetiva = CA base da ficha + bônus de buffs ativos de CA. */
export function effectiveArmorClass(sheet: Pick<CharacterSheet, 'armorClass' | 'activeBuffs'>): number {
  return sheet.armorClass + acBonusFromBuffs(sheet.activeBuffs).flatBonus;
}
