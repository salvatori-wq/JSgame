// JSgame · D&D 5e magias (PHB cap 11).
// ~30 magias dos níveis 0-3, as mais usadas. Cada uma com efeito mecânico
// declarado pro engine processar (damage/heal/condition/utility).
// Server resolve: rola dado, aplica salvas, gasta slot.

import type { AbilityKey } from './attributes';
import type { ClassId } from './classes';
import type { ConditionId } from './conditions';

export type SpellLevel = 0 | 1 | 2 | 3;
export type SpellSchool =
  | 'abjuracao' | 'adivinhacao' | 'conjuracao' | 'encantamento'
  | 'evocacao' | 'ilusao' | 'necromancia' | 'transmutacao';

export type SpellId =
  // Cantrips (lvl 0)
  | 'fire-bolt' | 'sacred-flame' | 'eldritch-blast' | 'vicious-mockery'
  | 'light' | 'mage-hand' | 'guidance' | 'resistance' | 'prestidigitation'
  // Lvl 1
  | 'magic-missile' | 'cure-wounds' | 'healing-word' | 'shield'
  | 'burning-hands' | 'bless' | 'faerie-fire' | 'shield-of-faith'
  | 'charm-person' | 'sleep' | 'thunderwave' | 'mage-armor'
  // Lvl 2
  | 'misty-step' | 'hold-person' | 'scorching-ray' | 'invisibility'
  | 'lesser-restoration' | 'aid'
  // Lvl 3
  | 'fireball' | 'lightning-bolt' | 'counterspell' | 'mass-healing-word' | 'revivify' | 'haste';

export type SpellEffect =
  // Dano direto ou via save
  | { kind: 'damage'; dice: string; damageType: string; save?: { ability: AbilityKey; halfOnSave: boolean }; aoe?: boolean }
  // Cura (heal points)
  | { kind: 'heal'; dice: string; bonusFromCastingMod?: boolean }
  // Condição (com ou sem save)
  | { kind: 'condition'; condition: ConditionId; save?: { ability: AbilityKey }; duration: string }
  // Buff sem mecânica numérica direta (DM narra)
  | { kind: 'buff'; description: string; duration: string }
  // Utility (DM narra livre — usado quando efeito é narrativo)
  | { kind: 'utility'; description: string };

export interface SpellDef {
  id: SpellId;
  name: string;
  level: SpellLevel;
  school: SpellSchool;
  classes: ClassId[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration?: boolean;
  ritual?: boolean;
  description: string;
  effect: SpellEffect;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  // ═════════ CANTRIPS (nv 0) — não gastam slot ═════════
  'fire-bolt': {
    id: 'fire-bolt', name: 'Raio de Fogo', level: 0, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: 'Instantâneo',
    description: 'Lança um pelourinho de fogo numa criatura/objeto. Acerto: 1d10 fogo.',
    effect: { kind: 'damage', dice: '1d10', damageType: 'fogo' },
  },
  'sacred-flame': {
    id: 'sacred-flame', name: 'Chama Sagrada', level: 0, school: 'evocacao',
    classes: ['clerigo'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'Luz divina cai no alvo. Sem cobertura. Save Des ou sofre 1d8 radiante.',
    effect: { kind: 'damage', dice: '1d8', damageType: 'radiante', save: { ability: 'des', halfOnSave: false } },
  },
  'eldritch-blast': {
    id: 'eldritch-blast', name: 'Rajada Mística', level: 0, school: 'evocacao',
    classes: ['bruxo'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: 'Instantâneo',
    description: 'Feixe de energia crepitante voa em direção ao alvo. 1d10 de força.',
    effect: { kind: 'damage', dice: '1d10', damageType: 'força' },
  },
  'vicious-mockery': {
    id: 'vicious-mockery', name: 'Zombaria Cruel', level: 0, school: 'encantamento',
    classes: ['bardo'],
    castingTime: '1 ação', range: '18m', components: 'V', duration: 'Instantâneo',
    description: 'Insultos sobrenaturais. Save Sab ou 1d4 psíquico + desvantagem no próximo ataque.',
    effect: { kind: 'damage', dice: '1d4', damageType: 'psíquico', save: { ability: 'sab', halfOnSave: false } },
  },
  light: {
    id: 'light', name: 'Luz', level: 0, school: 'evocacao',
    classes: ['bardo', 'clerigo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, M', duration: '1 hora',
    description: 'Objeto emite luz brilhante num raio de 6m por 1 hora.',
    effect: { kind: 'utility', description: 'Ilumina área 6m em volta do objeto tocado.' },
  },
  'mage-hand': {
    id: 'mage-hand', name: 'Mão Mágica', level: 0, school: 'conjuracao',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '9m', components: 'V, S', duration: '1 minuto',
    description: 'Mão fantasmal manipula objetos leves (até 5kg) a distância.',
    effect: { kind: 'utility', description: 'Mão espectral move/usa objetos leves a 9m.' },
  },
  guidance: {
    id: 'guidance', name: 'Orientação', level: 0, school: 'adivinhacao',
    classes: ['clerigo', 'druida'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: '1 minuto',
    concentration: true,
    description: 'Aliado tocado ganha +1d4 num teste de habilidade (sua escolha, antes de rolar).',
    effect: { kind: 'buff', description: '+1d4 em 1 teste de habilidade.', duration: '1 minuto' },
  },
  resistance: {
    id: 'resistance', name: 'Resistência', level: 0, school: 'abjuracao',
    classes: ['clerigo', 'druida'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Aliado tocado ganha +1d4 em uma resistência (escolha, antes de rolar).',
    effect: { kind: 'buff', description: '+1d4 em 1 jogada de resistência.', duration: '1 minuto' },
  },
  prestidigitation: {
    id: 'prestidigitation', name: 'Prestidigitação', level: 0, school: 'transmutacao',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '3m', components: 'V, S', duration: 'até 1 hora',
    description: 'Truques mágicos triviais: limpa, esquenta, cor, sabor, faísca, etc.',
    effect: { kind: 'utility', description: 'Truques mágicos triviais sem efeito mecânico.' },
  },

  // ═════════ NÍVEL 1 ═════════
  'magic-missile': {
    id: 'magic-missile', name: 'Mísseis Mágicos', level: 1, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: 'Instantâneo',
    description: '3 dardos brilhantes acertam alvos visíveis automaticamente. 1d4+1 força cada.',
    effect: { kind: 'damage', dice: '3d4+3', damageType: 'força' }, // 3 dardos × (1d4+1)
  },
  'cure-wounds': {
    id: 'cure-wounds', name: 'Curar Ferimentos', level: 1, school: 'evocacao',
    classes: ['bardo', 'clerigo', 'druida', 'paladino', 'patrulheiro'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: 'Instantâneo',
    description: 'Cura criatura tocada em 1d8 + modificador de conjuração HP.',
    effect: { kind: 'heal', dice: '1d8', bonusFromCastingMod: true },
  },
  'healing-word': {
    id: 'healing-word', name: 'Palavra Curativa', level: 1, school: 'evocacao',
    classes: ['bardo', 'clerigo', 'druida'],
    castingTime: '1 ação bônus', range: '18m', components: 'V', duration: 'Instantâneo',
    description: 'Cura criatura à distância: 1d4 + mod de conjuração HP. Ação bônus.',
    effect: { kind: 'heal', dice: '1d4', bonusFromCastingMod: true },
  },
  shield: {
    id: 'shield', name: 'Escudo', level: 1, school: 'abjuracao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 reação', range: 'Pessoal', components: 'V, S', duration: '1 round',
    description: 'Reação ao ser atingido: +5 CA até o próximo turno. Anula Mísseis Mágicos.',
    effect: { kind: 'buff', description: '+5 CA até próximo turno (anula mísseis mágicos).', duration: '1 round' },
  },
  'burning-hands': {
    id: 'burning-hands', name: 'Mãos Flamejantes', level: 1, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '4,5m cone', components: 'V, S', duration: 'Instantâneo',
    description: 'Cone de fogo de 4,5m. Save Des ou 3d6 fogo (metade se sucesso).',
    effect: { kind: 'damage', dice: '3d6', damageType: 'fogo', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  bless: {
    id: 'bless', name: 'Bênção', level: 1, school: 'encantamento',
    classes: ['clerigo', 'paladino'],
    castingTime: '1 ação', range: '9m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Até 3 aliados ganham +1d4 em ataques e resistências por 1 minuto.',
    effect: { kind: 'buff', description: '+1d4 em ataques e saves pra até 3 aliados.', duration: '1 minuto' },
  },
  'faerie-fire': {
    id: 'faerie-fire', name: 'Fogo Feérico', level: 1, school: 'evocacao',
    classes: ['bardo', 'druida'],
    castingTime: '1 ação', range: '18m', components: 'V', duration: '1 minuto',
    concentration: true,
    description: 'Cubo 6m: criaturas falham Des save ou brilham — vantagem em ataques contra elas.',
    effect: { kind: 'buff', description: 'Alvos brilhando: vantagem em ataques contra eles, não podem ficar invisíveis.', duration: '1 minuto' },
  },
  'shield-of-faith': {
    id: 'shield-of-faith', name: 'Escudo da Fé', level: 1, school: 'abjuracao',
    classes: ['clerigo', 'paladino'],
    castingTime: '1 ação bônus', range: '18m', components: 'V, S, M', duration: '10 minutos',
    concentration: true,
    description: 'Aliado a 18m ganha +2 CA por 10 min.',
    effect: { kind: 'buff', description: '+2 CA num aliado.', duration: '10 minutos' },
  },
  'charm-person': {
    id: 'charm-person', name: 'Enfeitiçar Pessoa', level: 1, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '9m', components: 'V, S', duration: '1 hora',
    description: 'Humanoide save Sab ou fica enfeitiçado por 1h. Vantagem em interação social.',
    effect: { kind: 'condition', condition: 'enfeiticado', save: { ability: 'sab' }, duration: '1 hora' },
  },
  sleep: {
    id: 'sleep', name: 'Sono', level: 1, school: 'encantamento',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '27m', components: 'V, S, M', duration: '1 minuto',
    description: '5d8 HP de criaturas na área caem inconscientes (menos HP primeiro).',
    effect: { kind: 'condition', condition: 'inconsciente', duration: '1 minuto' },
  },
  thunderwave: {
    id: 'thunderwave', name: 'Onda Trovejante', level: 1, school: 'evocacao',
    classes: ['bardo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '4,5m cubo', components: 'V, S', duration: 'Instantâneo',
    description: 'Onda sônica empurra 3m. Save Con ou 2d8 trovejante (metade se sucesso).',
    effect: { kind: 'damage', dice: '2d8', damageType: 'trovejante', save: { ability: 'con', halfOnSave: true }, aoe: true },
  },
  'mage-armor': {
    id: 'mage-armor', name: 'Armadura Arcana', level: 1, school: 'abjuracao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '8 horas',
    description: 'Aliado sem armadura ganha CA 13 + mod Des por 8h.',
    effect: { kind: 'buff', description: 'CA base = 13 + mod Des por 8h.', duration: '8 horas' },
  },

  // ═════════ NÍVEL 2 ═════════
  'misty-step': {
    id: 'misty-step', name: 'Passo Brumoso', level: 2, school: 'conjuracao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação bônus', range: 'Pessoal', components: 'V', duration: 'Instantâneo',
    description: 'Teleporta até 9m pra um lugar visível. Ação bônus.',
    effect: { kind: 'utility', description: 'Teleporte 9m.' },
  },
  'hold-person': {
    id: 'hold-person', name: 'Imobilizar Pessoa', level: 2, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Humanoide save Sab ou fica paralisado. Repete save a cada turno.',
    effect: { kind: 'condition', condition: 'paralisado', save: { ability: 'sab' }, duration: '1 minuto' },
  },
  'scorching-ray': {
    id: 'scorching-ray', name: 'Raio Incandescente', level: 2, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: 'Instantâneo',
    description: '3 raios de fogo, cada um requer ataque. Acerto: 2d6 fogo.',
    effect: { kind: 'damage', dice: '6d6', damageType: 'fogo' }, // simplificação: total se todos acertam
  },
  invisibility: {
    id: 'invisibility', name: 'Invisibilidade', level: 2, school: 'ilusao',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '1 hora',
    concentration: true,
    description: 'Aliado fica invisível por 1h. Cai se atacar ou conjurar.',
    effect: { kind: 'condition', condition: 'invisivel', duration: '1 hora' },
  },
  'lesser-restoration': {
    id: 'lesser-restoration', name: 'Restauração Menor', level: 2, school: 'abjuracao',
    classes: ['bardo', 'clerigo', 'druida', 'paladino', 'patrulheiro'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: 'Instantâneo',
    description: 'Cura uma condição: envenenado, paralisado, surdo, cego, doença.',
    effect: { kind: 'utility', description: 'Remove 1 condição: envenenado/paralisado/surdo/cego.' },
  },
  aid: {
    id: 'aid', name: 'Auxílio', level: 2, school: 'abjuracao',
    classes: ['bardo', 'clerigo', 'paladino'],
    castingTime: '1 ação', range: '9m', components: 'V, S, M', duration: '8 horas',
    description: 'Até 3 aliados ganham +5 HP máximo e atual por 8h.',
    effect: { kind: 'heal', dice: '5' }, // simplificação: cura +5 fixo
  },

  // ═════════ NÍVEL 3 ═════════
  fireball: {
    id: 'fireball', name: 'Bola de Fogo', level: 3, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '45m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Esfera de fogo explode num raio de 6m. Save Des ou 8d6 fogo (metade se sucesso).',
    effect: { kind: 'damage', dice: '8d6', damageType: 'fogo', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  'lightning-bolt': {
    id: 'lightning-bolt', name: 'Relâmpago', level: 3, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '30m linha', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Linha de raios de 30m × 1,5m. Save Des ou 8d6 elétrico (metade se sucesso).',
    effect: { kind: 'damage', dice: '8d6', damageType: 'elétrico', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  counterspell: {
    id: 'counterspell', name: 'Contramágica', level: 3, school: 'abjuracao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 reação', range: '18m', components: 'S', duration: 'Instantâneo',
    description: 'Reage a magia inimiga de nv 3 ou menos sendo conjurada — anula automaticamente.',
    effect: { kind: 'utility', description: 'Anula magia inimiga de nv ≤ 3 sendo conjurada.' },
  },
  'mass-healing-word': {
    id: 'mass-healing-word', name: 'Palavra Curativa em Massa', level: 3, school: 'evocacao',
    classes: ['clerigo'],
    castingTime: '1 ação bônus', range: '18m', components: 'V', duration: 'Instantâneo',
    description: 'Cura até 6 aliados visíveis em 1d4 + mod de conjuração HP cada.',
    effect: { kind: 'heal', dice: '1d4', bonusFromCastingMod: true },
  },
  revivify: {
    id: 'revivify', name: 'Reviver', level: 3, school: 'necromancia',
    classes: ['clerigo', 'paladino'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Criatura morta há menos de 1 minuto volta com 1 HP.',
    effect: { kind: 'heal', dice: '1' }, // simplificação: 1 HP
  },
  haste: {
    id: 'haste', name: 'Pressa', level: 3, school: 'transmutacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '9m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Aliado: +2 CA, vantagem em saves Des, deslocamento dobrado, +1 ação extra (limitada). 1 min.',
    effect: { kind: 'buff', description: '+2 CA, vantagem Des saves, mov dobrado, +1 ação por turno.', duration: '1 minuto' },
  },
};

export function getSpell(id: SpellId): SpellDef {
  return SPELLS[id];
}

export const ALL_SPELLS: SpellDef[] = Object.values(SPELLS);

// Filtra magias por classe e nível máximo permitido.
export function spellsForClass(classId: ClassId, maxLevel: SpellLevel = 3): SpellDef[] {
  return ALL_SPELLS.filter((s) => s.classes.includes(classId) && s.level <= maxLevel);
}

// DC de saving throw vs magia desse caster: 8 + prof + casting ability mod.
export function spellSaveDC(profBonus: number, castingAbilityMod: number): number {
  return 8 + profBonus + castingAbilityMod;
}

// Attack bonus de magia: prof + casting ability mod.
export function spellAttackBonus(profBonus: number, castingAbilityMod: number): number {
  return profBonus + castingAbilityMod;
}
