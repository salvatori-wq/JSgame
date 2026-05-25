// JSgame · D&D 5e magias (PHB cap 11).
// ~30 magias dos níveis 0-3, as mais usadas. Cada uma com efeito mecânico
// declarado pro engine processar (damage/heal/condition/utility).
// Server resolve: rola dado, aplica salvas, gasta slot.

import type { AbilityKey } from './attributes';
import type { ClassId } from './classes';
import type { ConditionId } from './conditions';

export type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SpellSchool =
  | 'abjuracao' | 'adivinhacao' | 'conjuracao' | 'encantamento'
  | 'evocacao' | 'ilusao' | 'necromancia' | 'transmutacao';

export type SpellId =
  // Cantrips (lvl 0)
  | 'fire-bolt' | 'sacred-flame' | 'eldritch-blast' | 'vicious-mockery'
  | 'light' | 'mage-hand' | 'guidance' | 'resistance' | 'prestidigitation'
  | 'minor-illusion' | 'shocking-grasp' | 'ray-of-frost' | 'spare-the-dying'
  // Lvl 1
  | 'magic-missile' | 'cure-wounds' | 'healing-word' | 'shield'
  | 'burning-hands' | 'bless' | 'faerie-fire' | 'shield-of-faith'
  | 'charm-person' | 'sleep' | 'thunderwave' | 'mage-armor'
  | 'detect-magic' | 'identify' | 'disguise-self' | 'feather-fall'
  // Lvl 2
  | 'misty-step' | 'hold-person' | 'scorching-ray' | 'invisibility'
  | 'lesser-restoration' | 'aid' | 'web' | 'spiritual-weapon'
  | 'mirror-image' | 'silence' | 'darkness'
  // Lvl 3
  | 'fireball' | 'lightning-bolt' | 'counterspell' | 'mass-healing-word'
  | 'revivify' | 'haste' | 'animate-dead' | 'dispel-magic' | 'fly'
  | 'tongues' | 'water-walk' | 'slow'
  // Lvl 4
  | 'polymorph' | 'wall-of-fire' | 'greater-invisibility' | 'banishment'
  | 'confusion' | 'ice-storm' | 'stoneskin' | 'dimension-door'
  // Lvl 5
  | 'cone-of-cold' | 'hold-monster' | 'mass-cure-wounds' | 'wall-of-force'
  | 'animate-objects' | 'greater-restoration' | 'scrying' | 'modify-memory'
  // Lvl 6
  | 'disintegrate' | 'chain-lightning' | 'heal' | 'globe-of-invulnerability'
  | 'sunbeam' | 'true-seeing' | 'mass-suggestion'
  // Lvl 7
  | 'teleport' | 'finger-of-death' | 'plane-shift' | 'prismatic-spray' | 'reverse-gravity'
  // Lvl 8
  | 'power-word-stun' | 'sunburst' | 'mind-blank' | 'dominate-monster'
  // Lvl 9
  | 'wish' | 'meteor-swarm' | 'power-word-kill' | 'time-stop' | 'mass-heal' | 'true-resurrection';

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

  // ═════════ CANTRIPS extras ═════════
  'minor-illusion': {
    id: 'minor-illusion', name: 'Ilusão Menor', level: 0, school: 'ilusao',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '9m', components: 'S, M', duration: '1 minuto',
    description: 'Cria som ou imagem 1.5m² por 1min. INT check pra detectar.',
    effect: { kind: 'utility', description: 'Som ou imagem ilusória 1.5m³.' },
  },
  'shocking-grasp': {
    id: 'shocking-grasp', name: 'Mão Eletrizante', level: 0, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: 'Instantâneo',
    description: 'Toque com mão crepitante. Hit: 1d8 elétrico, alvo perde reações até próximo turno.',
    effect: { kind: 'damage', dice: '1d8', damageType: 'elétrico' },
  },
  'ray-of-frost': {
    id: 'ray-of-frost', name: 'Raio de Gelo', level: 0, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'Raio gelado. Hit: 1d8 frio + reduz deslocamento em 3m até próximo turno.',
    effect: { kind: 'damage', dice: '1d8', damageType: 'frio' },
  },
  'spare-the-dying': {
    id: 'spare-the-dying', name: 'Salvar Moribundo', level: 0, school: 'necromancia',
    classes: ['clerigo'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: 'Instantâneo',
    description: 'Estabiliza criatura em 0 HP. Sem death saves até dano novo.',
    effect: { kind: 'utility', description: 'Estabiliza criatura inconsciente.' },
  },

  // ═════════ Nv 1 extras ═════════
  'detect-magic': {
    id: 'detect-magic', name: 'Detectar Magia', level: 1, school: 'adivinhacao',
    classes: ['bardo', 'clerigo', 'druida', 'feiticeiro', 'mago', 'paladino', 'patrulheiro'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V, S', duration: '10 minutos',
    concentration: true, ritual: true,
    description: 'Sente magias num raio de 9m. Vê auras coloridas das escolas.',
    effect: { kind: 'utility', description: 'Detecta magias em 9m por 10min.' },
  },
  identify: {
    id: 'identify', name: 'Identificar', level: 1, school: 'adivinhacao',
    classes: ['bardo', 'mago'],
    castingTime: '1 minuto', range: 'Toque', components: 'V, S, M', duration: 'Instantâneo',
    ritual: true,
    description: 'Identifica propriedades de item mágico tocado.',
    effect: { kind: 'utility', description: 'Identifica propriedades de item mágico.' },
  },
  'disguise-self': {
    id: 'disguise-self', name: 'Disfarce', level: 1, school: 'ilusao',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V, S', duration: '1 hora',
    description: 'Aparência alterada por 1h. INT check pra detectar.',
    effect: { kind: 'utility', description: 'Aparência diferente por 1h.' },
  },
  'feather-fall': {
    id: 'feather-fall', name: 'Queda Suave', level: 1, school: 'transmutacao',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 reação', range: '18m', components: 'V, M', duration: '1 minuto',
    description: 'Até 5 criaturas em queda descem 18m/round, sem dano.',
    effect: { kind: 'utility', description: 'Até 5 aliados caem suavemente.' },
  },

  // ═════════ Nv 2 extras ═════════
  web: {
    id: 'web', name: 'Teia', level: 2, school: 'conjuracao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S, M', duration: '1 hora',
    concentration: true,
    description: 'Teias preenchem 6m². Criaturas DEX save ou ficam restritas.',
    effect: { kind: 'condition', condition: 'restrito', save: { ability: 'des' }, duration: '1 hora' },
  },
  'spiritual-weapon': {
    id: 'spiritual-weapon', name: 'Arma Espiritual', level: 2, school: 'evocacao',
    classes: ['clerigo'],
    castingTime: '1 ação bônus', range: '18m', components: 'V, S', duration: '1 minuto',
    description: 'Arma flutuante. Ação bônus: ataca (mod conj+prof) por 1d8+mod força.',
    effect: { kind: 'damage', dice: '1d8', damageType: 'força', bonusFromCastingMod: true } as never,
  },
  'mirror-image': {
    id: 'mirror-image', name: 'Imagens Espelhadas', level: 2, school: 'ilusao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V, S', duration: '1 minuto',
    description: '3 duplicatas idênticas. Ataques têm chance de acertar uma duplicata (que some).',
    effect: { kind: 'buff', description: '3 duplicatas absorvem ataques.', duration: '1 minuto' },
  },
  silence: {
    id: 'silence', name: 'Silêncio', level: 2, school: 'ilusao',
    classes: ['bardo', 'clerigo', 'patrulheiro'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: '10 minutos',
    concentration: true, ritual: true,
    description: 'Esfera 6m sem som. Mágias V impossíveis dentro.',
    effect: { kind: 'utility', description: 'Sem som em 6m por 10min.' },
  },
  darkness: {
    id: 'darkness', name: 'Escuridão', level: 2, school: 'evocacao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, M', duration: '10 minutos',
    concentration: true,
    description: 'Escuridão mágica em 4.5m raio. Bloqueia visão (mesmo darkvision).',
    effect: { kind: 'utility', description: 'Escuridão mágica 4.5m raio.' },
  },

  // ═════════ Nv 3 extras ═════════
  'animate-dead': {
    id: 'animate-dead', name: 'Animar Morto', level: 3, school: 'necromancia',
    classes: ['bruxo', 'clerigo', 'mago'],
    castingTime: '1 minuto', range: '3m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Anima cadáver humanoide como esqueleto/zumbi controlado 24h.',
    effect: { kind: 'utility', description: 'Cria esqueleto/zumbi servo por 24h.' },
  },
  'dispel-magic': {
    id: 'dispel-magic', name: 'Dissipar Magia', level: 3, school: 'abjuracao',
    classes: ['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago', 'paladino'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: 'Instantâneo',
    description: 'Cancela magia ativa de nv ≤ slot usado. Acima disso, check conj DC 10+nv.',
    effect: { kind: 'utility', description: 'Cancela magia de nv ≤ slot.' },
  },
  fly: {
    id: 'fly', name: 'Voo', level: 3, school: 'transmutacao',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '10 minutos',
    concentration: true,
    description: 'Aliado tocado ganha deslocamento de voo 18m por 10min.',
    effect: { kind: 'buff', description: 'Voo 18m por 10min.', duration: '10 minutos' },
  },
  tongues: {
    id: 'tongues', name: 'Línguas', level: 3, school: 'adivinhacao',
    classes: ['bardo', 'bruxo', 'clerigo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, M', duration: '1 hora',
    description: 'Aliado tocado entende e fala qualquer idioma por 1h.',
    effect: { kind: 'utility', description: 'Entende/fala todos idiomas 1h.' },
  },
  'water-walk': {
    id: 'water-walk', name: 'Andar n\'Água', level: 3, school: 'transmutacao',
    classes: ['clerigo', 'druida', 'feiticeiro', 'patrulheiro'],
    castingTime: '1 ação', range: '9m', components: 'V, S, M', duration: '1 hora',
    description: 'Até 10 criaturas andam sobre líquidos por 1h.',
    effect: { kind: 'utility', description: 'Até 10 aliados andam sobre água.' },
  },
  slow: {
    id: 'slow', name: 'Lentidão', level: 3, school: 'transmutacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: '6 criaturas em 12m. WIS save ou: mov reduzido pela metade, -2 CA, -2 DEX save, 1 ataque por turno.',
    effect: { kind: 'buff', description: '6 alvos: mov/2, -2 CA, sem reações.', duration: '1 minuto' },
  },

  // ═════════ Nv 4 ═════════
  polymorph: {
    id: 'polymorph', name: 'Metamorfose', level: 4, school: 'transmutacao',
    classes: ['bardo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S, M', duration: '1 hora',
    concentration: true,
    description: 'Transforma criatura em fera de CR ≤ alvo. WIS save resiste. Hipopotamo, sapo, etc.',
    effect: { kind: 'utility', description: 'Transforma alvo em fera por 1h.' },
  },
  'wall-of-fire': {
    id: 'wall-of-fire', name: 'Muro de Fogo', level: 4, school: 'evocacao',
    classes: ['druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Parede de fogo 18m comp. Quem encostar: 5d8 fogo.',
    effect: { kind: 'damage', dice: '5d8', damageType: 'fogo', aoe: true },
  },
  'greater-invisibility': {
    id: 'greater-invisibility', name: 'Invisibilidade Maior', level: 4, school: 'ilusao',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: '1 minuto',
    concentration: true,
    description: 'Aliado fica invisível mesmo após atacar/conjurar. 1 min.',
    effect: { kind: 'condition', condition: 'invisivel', duration: '1 minuto' },
  },
  banishment: {
    id: 'banishment', name: 'Banimento', level: 4, school: 'abjuracao',
    classes: ['clerigo', 'paladino', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'CHA save ou alvo sumido em demiplano. Se concentração mantida 1min, vai pra sempre.',
    effect: { kind: 'utility', description: 'Bane alvo pra outro plano. 1min ou permanente.' },
  },
  confusion: {
    id: 'confusion', name: 'Confusão', level: 4, school: 'encantamento',
    classes: ['bardo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '27m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Esfera 3m: WIS save ou alvos rolam d10 a cada turno pra ação aleatória.',
    effect: { kind: 'condition', condition: 'incapacitado', save: { ability: 'sab' }, duration: '1 minuto' },
  },
  'ice-storm': {
    id: 'ice-storm', name: 'Tempestade de Gelo', level: 4, school: 'evocacao',
    classes: ['druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '90m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Cilindro 6m raio. DEX save: 2d8 contundente + 4d6 frio (metade se save).',
    effect: { kind: 'damage', dice: '4d6', damageType: 'frio', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  stoneskin: {
    id: 'stoneskin', name: 'Pele Pétrea', level: 4, school: 'abjuracao',
    classes: ['druida', 'feiticeiro', 'mago', 'patrulheiro'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '1 hora',
    concentration: true,
    description: 'Aliado ganha resistência a contundente/cortante/perfurante de não-mágicas por 1h.',
    effect: { kind: 'buff', description: 'Resistência a dano físico não-mágico por 1h.', duration: '1 hora' },
  },
  'dimension-door': {
    id: 'dimension-door', name: 'Porta Dimensional', level: 4, school: 'conjuracao',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '150m', components: 'V', duration: 'Instantâneo',
    description: 'Teleporta você + 1 criatura voluntária pra até 150m.',
    effect: { kind: 'utility', description: 'Teleporte 150m (+1 aliado).' },
  },

  // ═════════ Nv 5 ═════════
  'cone-of-cold': {
    id: 'cone-of-cold', name: 'Cone de Frio', level: 5, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m cone', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Cone 18m. CON save: 8d8 frio (metade se save).',
    effect: { kind: 'damage', dice: '8d8', damageType: 'frio', save: { ability: 'con', halfOnSave: true }, aoe: true },
  },
  'hold-monster': {
    id: 'hold-monster', name: 'Imobilizar Monstro', level: 5, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '27m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Qualquer criatura (não-morto-vivo). WIS save ou paralisado. Repete save por turno.',
    effect: { kind: 'condition', condition: 'paralisado', save: { ability: 'sab' }, duration: '1 minuto' },
  },
  'mass-cure-wounds': {
    id: 'mass-cure-wounds', name: 'Curar Ferimentos em Massa', level: 5, school: 'evocacao',
    classes: ['bardo', 'clerigo', 'druida'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'Até 6 aliados em esfera 9m: 3d8 + mod conj HP.',
    effect: { kind: 'heal', dice: '3d8', bonusFromCastingMod: true },
  },
  'wall-of-force': {
    id: 'wall-of-force', name: 'Muro de Força', level: 5, school: 'evocacao',
    classes: ['mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S, M', duration: '10 minutos',
    concentration: true,
    description: 'Parede invisível indestrutível. 10 painéis 3m² ou esfera 3m. Bloqueia tudo, exceto teleporte.',
    effect: { kind: 'utility', description: 'Parede indestrutível 10min.' },
  },
  'animate-objects': {
    id: 'animate-objects', name: 'Animar Objetos', level: 5, school: 'transmutacao',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '36m', components: 'V, S', duration: '1 minuto',
    concentration: true,
    description: 'Até 10 objetos pequenos viram aliados. Cadeiras voam, espadas atacam sozinhas.',
    effect: { kind: 'utility', description: 'Anima 10 objetos pra lutar.' },
  },
  'greater-restoration': {
    id: 'greater-restoration', name: 'Restauração Maior', level: 5, school: 'abjuracao',
    classes: ['bardo', 'clerigo', 'druida'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Remove 1: enfeitiçado, petrificado, exaustão 1 nível, redução de stat, redução de máx HP.',
    effect: { kind: 'utility', description: 'Remove condição grave.' },
  },
  scrying: {
    id: 'scrying', name: 'Vidência', level: 5, school: 'adivinhacao',
    classes: ['bardo', 'clerigo', 'druida', 'mago'],
    castingTime: '10 minutos', range: 'Pessoal', components: 'V, S, M', duration: '10 minutos',
    concentration: true,
    description: 'Espia criatura conhecida. WIS save resiste. Vê e ouve como se estivesse lá.',
    effect: { kind: 'utility', description: 'Espia alvo conhecido remotamente.' },
  },
  'modify-memory': {
    id: 'modify-memory', name: 'Modificar Memória', level: 5, school: 'encantamento',
    classes: ['bardo', 'mago'],
    castingTime: '1 ação', range: '9m', components: 'V, S', duration: '1 minuto',
    concentration: true,
    description: 'WIS save ou alvo esquece/altera memória de evento. 24h pra trás.',
    effect: { kind: 'utility', description: 'Apaga/altera memória do alvo.' },
  },

  // ═════════ Nv 6 ═════════
  disintegrate: {
    id: 'disintegrate', name: 'Desintegrar', level: 6, school: 'transmutacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'DEX save: 10d6+40 dano força. Mata = vira pó. Não funciona em magia/objeto mágico.',
    effect: { kind: 'damage', dice: '10d6+40', damageType: 'força', save: { ability: 'des', halfOnSave: false } },
  },
  'chain-lightning': {
    id: 'chain-lightning', name: 'Relâmpago em Cadeia', level: 6, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '45m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Raio primário + 3 secundários. DEX save: 10d8 elétrico cada (metade se save).',
    effect: { kind: 'damage', dice: '10d8', damageType: 'elétrico', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  heal: {
    id: 'heal', name: 'Curar', level: 6, school: 'evocacao',
    classes: ['clerigo', 'druida'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'Cura 70 HP. Remove cego, surdo, doenças.',
    effect: { kind: 'heal', dice: '70' },
  },
  'globe-of-invulnerability': {
    id: 'globe-of-invulnerability', name: 'Esfera Invulnerável', level: 6, school: 'abjuracao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Esfera 3m raio em volta de você. Bloqueia magias nv ≤ 5 lançadas de fora.',
    effect: { kind: 'buff', description: 'Bloqueia magias nv ≤ 5.', duration: '1 minuto' },
  },
  sunbeam: {
    id: 'sunbeam', name: 'Raio Solar', level: 6, school: 'evocacao',
    classes: ['druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m linha', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Linha 18m de luz solar. CON save: 6d8 radiante + cego por 1 turno (metade se save).',
    effect: { kind: 'damage', dice: '6d8', damageType: 'radiante', save: { ability: 'con', halfOnSave: true }, aoe: true },
  },
  'true-seeing': {
    id: 'true-seeing', name: 'Visão Verdadeira', level: 6, school: 'adivinhacao',
    classes: ['bardo', 'bruxo', 'clerigo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: '1 hora',
    description: 'Aliado vê: invisível, ilusões, formas verdadeiras, plano etéreo. Darkvision 36m.',
    effect: { kind: 'buff', description: 'Vê invisível + ilusões + plano etéreo.', duration: '1 hora' },
  },
  'mass-suggestion': {
    id: 'mass-suggestion', name: 'Sugestão em Massa', level: 6, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, M', duration: '24 horas',
    description: 'Até 12 criaturas WIS save ou aceitam sugestão razoável por 24h.',
    effect: { kind: 'condition', condition: 'enfeiticado', save: { ability: 'sab' }, duration: '24 horas' },
  },

  // ═════════ Nv 7 ═════════
  teleport: {
    id: 'teleport', name: 'Teletransporte', level: 7, school: 'conjuracao',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '3m', components: 'V', duration: 'Instantâneo',
    description: 'Teleporta até 8 criaturas pra local conhecido no mesmo plano. Roll pra precisão.',
    effect: { kind: 'utility', description: 'Teleporte longa distância (até 8 criaturas).' },
  },
  'finger-of-death': {
    id: 'finger-of-death', name: 'Dedo da Morte', level: 7, school: 'necromancia',
    classes: ['bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'CON save: 7d8+30 necrótico (metade se save). Mata humanoide = vira zumbi servo.',
    effect: { kind: 'damage', dice: '7d8+30', damageType: 'necrótico', save: { ability: 'con', halfOnSave: true } },
  },
  'plane-shift': {
    id: 'plane-shift', name: 'Mudança Planar', level: 7, school: 'conjuracao',
    classes: ['bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Até 8 aliados voluntários movem pra outro plano. Versão hostil: 1 alvo, CHA save.',
    effect: { kind: 'utility', description: 'Move party pra outro plano.' },
  },
  'prismatic-spray': {
    id: 'prismatic-spray', name: 'Pulverização Prismática', level: 7, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m cone', components: 'V, S', duration: 'Instantâneo',
    description: '8 raios de cores diferentes em cone 18m. Cada alvo rola d8 pra cor: fogo/ácido/elétrico/veneno/frio/radiante/psíquico/petrificado.',
    effect: { kind: 'damage', dice: '10d6', damageType: 'múltiplo', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  'reverse-gravity': {
    id: 'reverse-gravity', name: 'Reverter Gravidade', level: 7, school: 'transmutacao',
    classes: ['druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '30m', components: 'V, S, M', duration: '1 minuto',
    concentration: true,
    description: 'Cilindro 30m alt × 15m raio: gravidade invertida. DEX save pra agarrar algo, ou caem pra cima.',
    effect: { kind: 'utility', description: 'Gravidade invertida em área grande.' },
  },

  // ═════════ Nv 8 ═════════
  'power-word-stun': {
    id: 'power-word-stun', name: 'Palavra do Poder: Atordoar', level: 8, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V', duration: 'até save',
    description: 'Alvo com ≤ 150 HP fica atordoado. CON save no fim do turno pra resistir.',
    effect: { kind: 'condition', condition: 'atordoado', save: { ability: 'con' }, duration: 'até save' },
  },
  sunburst: {
    id: 'sunburst', name: 'Explosão Solar', level: 8, school: 'evocacao',
    classes: ['druida', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '45m', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Esfera 18m raio. CON save: 12d6 radiante + cego 1min (metade se save).',
    effect: { kind: 'damage', dice: '12d6', damageType: 'radiante', save: { ability: 'con', halfOnSave: true }, aoe: true },
  },
  'mind-blank': {
    id: 'mind-blank', name: 'Mente em Branco', level: 8, school: 'abjuracao',
    classes: ['bardo', 'mago'],
    castingTime: '1 ação', range: 'Toque', components: 'V, S', duration: '24 horas',
    description: 'Aliado imune a dano psíquico, divinação, ler mente. 24h.',
    effect: { kind: 'buff', description: 'Imune psíquico/divinação 24h.', duration: '24 horas' },
  },
  'dominate-monster': {
    id: 'dominate-monster', name: 'Dominar Monstro', level: 8, school: 'encantamento',
    classes: ['bardo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: '1 hora',
    concentration: true,
    description: 'WIS save ou alvo obedece comandos telepatic por 1h. Dano permite save novo.',
    effect: { kind: 'condition', condition: 'enfeiticado', save: { ability: 'sab' }, duration: '1 hora' },
  },

  // ═════════ Nv 9 ═════════
  wish: {
    id: 'wish', name: 'Desejo', level: 9, school: 'conjuracao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V', duration: 'Instantâneo',
    description: 'A magia mais poderosa. Duplica magia nv ≤ 8, cura 20 aliados, etc. Riscos catastróficos.',
    effect: { kind: 'utility', description: 'Realiza um desejo poderoso (DM narra consequências).' },
  },
  'meteor-swarm': {
    id: 'meteor-swarm', name: 'Chuva de Meteoros', level: 9, school: 'evocacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: '1.5km', components: 'V, S', duration: 'Instantâneo',
    description: '4 meteoros explodem. Esferas 12m raio. DEX save: 20d6 fogo + 20d6 contundente (metade se save).',
    effect: { kind: 'damage', dice: '40d6', damageType: 'fogo+contundente', save: { ability: 'des', halfOnSave: true }, aoe: true },
  },
  'power-word-kill': {
    id: 'power-word-kill', name: 'Palavra do Poder: Matar', level: 9, school: 'encantamento',
    classes: ['bardo', 'bruxo', 'feiticeiro', 'mago'],
    castingTime: '1 ação', range: '18m', components: 'V', duration: 'Instantâneo',
    description: 'Alvo com ≤ 100 HP morre instantaneamente. Sem save. Acima disso, sem efeito.',
    effect: { kind: 'utility', description: 'Mata alvo com HP ≤ 100. Sem save.' },
  },
  'time-stop': {
    id: 'time-stop', name: 'Parar o Tempo', level: 9, school: 'transmutacao',
    classes: ['feiticeiro', 'mago'],
    castingTime: '1 ação', range: 'Pessoal', components: 'V', duration: 'Instantâneo',
    description: 'Você toma 1d4+1 turnos seguidos enquanto tempo parado. Acaba se atacar alguém.',
    effect: { kind: 'utility', description: '1d4+1 turnos extras seguidos.' },
  },
  'mass-heal': {
    id: 'mass-heal', name: 'Curar em Massa', level: 9, school: 'evocacao',
    classes: ['clerigo'],
    castingTime: '1 ação', range: '18m', components: 'V, S', duration: 'Instantâneo',
    description: 'Cura 700 HP distribuído entre quantas criaturas você escolher (1+).',
    effect: { kind: 'heal', dice: '700' },
  },
  'true-resurrection': {
    id: 'true-resurrection', name: 'Ressurreição Verdadeira', level: 9, school: 'necromancia',
    classes: ['clerigo', 'druida'],
    castingTime: '1 hora', range: 'Toque', components: 'V, S, M', duration: 'Instantâneo',
    description: 'Ressuscita criatura morta há ≤ 200 anos. Corpo recriado completo. Cura todas condições.',
    effect: { kind: 'utility', description: 'Ressuscita criatura morta há até 200 anos.' },
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
