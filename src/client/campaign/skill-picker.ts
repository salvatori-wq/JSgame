// Sub-sprint D2 — Picker de perícia pra rolagem de dado iniciada pelo player.
// Quando o Mestre não pediu skill check mas o player quer rolar mesmo assim
// ("tentar algo"), abre essa modal pra escolher qual perícia rolar.
//
// Lista organizada por atributo (FOR/DES/CON/INT/SAB/CAR) com descrição
// curta. Server-side requestSkillCheck recebe { skill, dc? } e dispara
// pendingCheck normal — overlay do dado abre.

import { pickerDialog } from '../ui-modal';
import { SKILLS, type SkillId } from '../../dnd/skills';

interface SkillPickerOption {
  value: SkillId;
  label: string;
  description: string;
}

/**
 * Lista as 18 perícias D&D 5e formatadas pra pickerDialog.
 * Ordem: as mais comuns no início (Percepção/Investigação/Persuasão/Atletismo/Furtividade)
 * pra ergonomia de acesso rápido. Resto em ordem alfabética.
 */
export function listSkillsForPicker(): SkillPickerOption[] {
  const COMMON_ORDER: SkillId[] = [
    'percepcao', 'investigacao', 'persuasao', 'atletismo', 'furtividade',
    'enganacao', 'intuicao', 'atuacao', 'intimidacao', 'arcanismo',
  ];
  const rest: SkillId[] = (Object.keys(SKILLS) as SkillId[])
    .filter((s) => !COMMON_ORDER.includes(s))
    .sort((a, b) => SKILLS[a].name.localeCompare(SKILLS[b].name));
  const order: SkillId[] = [...COMMON_ORDER, ...rest];
  return order.map((id) => {
    const def = SKILLS[id];
    const abilityShort = def.ability.toUpperCase();
    return {
      value: id,
      label: `${def.name}`,
      description: `${abilityShort} · ${def.description}`,
    };
  });
}

/**
 * Abre picker e devolve skill escolhida (ou null se cancelado).
 * Caller passa pra socket.emit('requestSkillCheck', { skill }).
 */
export async function openSkillPicker(): Promise<SkillId | null> {
  const options = listSkillsForPicker();
  const picked = await pickerDialog<SkillId>({
    title: '🎲 Tentar algo — qual perícia?',
    text: 'Você decide rolar um teste sem esperar o Mestre. Escolha a perícia. O Mestre vai definir CD pelo contexto.',
    options,
  });
  return picked ?? null;
}
