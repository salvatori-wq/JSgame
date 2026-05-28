// Sprint Φ.2 — StatBlock D&D 5e autêntico.
// Componente que renderiza NPCs/Monsters no formato OFICIAL D&D 5e
// (igual aos livros: Monster Manual, Volo's). Layout extraído de
// rpgtex/DND-5e-LaTeX-Template lib/dndmonster.sty (MIT).
//
// Hierarquia visual: nome (Cinzel LARGE titlered) → tipo italic → régua sangue
// → AC/HP/Speed (3 itens com titlered label) → régua → ability scores 6-col
// → details (saves/skills/senses/languages/CR) → régua → traits → Actions
// → Reactions → Legendary Actions. Pegada papel-impresso com fundo tan.

import { el, escapeHtml } from '../util';
import type { EnemySnapshot, NpcMemory } from '../../shared/types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

export type CreatureSize =
  | 'minusculo' | 'pequeno' | 'medio' | 'grande' | 'enorme' | 'colossal';

export interface StatBlockAbilities {
  for: number;
  des: number;
  con: number;
  int: number;
  sab: number;
  car: number;
}

export interface StatBlockEntry {
  name: string;
  description: string;
}

export interface StatBlockData {
  name: string;
  size?: CreatureSize;
  type?: string;            // "humanoide (humano)" / "besta" / "morto-vivo"
  alignment?: string;       // "caótico mau" / "leal bom"
  ac: number;
  acSource?: string;        // "armadura de couro" / "natural"
  hp: number;
  maxHp?: number;           // se diferente de hp atual (combate)
  hpFormula?: string;       // "11 (2d8 + 2)"
  speed: string;            // "9m" / "6m, voo 18m"

  abilities: StatBlockAbilities;

  savingThrows?: string[];  // ["DES +5", "INT +3"]
  skills?: string[];        // ["Percepção +5", "Furtividade +6"]
  damageResistances?: string[];
  damageImmunities?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  senses?: string;          // "visão no escuro 18m, Percepção passiva 13"
  languages?: string;       // "comum, élfico" / "—"
  cr?: string;              // "1/4" / "2" / "21"
  xp?: number;              // derivado de cr se omitido

  traits?: StatBlockEntry[];      // habilidades passivas
  actions?: StatBlockEntry[];     // ações de combate
  reactions?: StatBlockEntry[];
  legendaryActions?: StatBlockEntry[];
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers puros (testáveis sem DOM)
// ════════════════════════════════════════════════════════════════════════════

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const CR_TO_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

export function crToXp(cr: string): number {
  return CR_TO_XP[cr] ?? 0;
}

export function sizeLabel(size: CreatureSize): string {
  switch (size) {
    case 'minusculo': return 'Minúsculo';
    case 'pequeno':   return 'Pequeno';
    case 'medio':     return 'Médio';
    case 'grande':    return 'Grande';
    case 'enorme':    return 'Enorme';
    case 'colossal':  return 'Colossal';
  }
}

// Converte EnemySnapshot (combat) → StatBlockData parcial.
// Usado quando player toca em inimigo no combate pra ver detalhes.
export function enemyToStatBlock(e: EnemySnapshot): StatBlockData {
  const abilities: StatBlockAbilities = e.abilityScores
    ? {
        for: e.abilityScores.for,
        des: e.abilityScores.des,
        con: e.abilityScores.con,
        int: e.abilityScores.int,
        sab: e.abilityScores.sab,
        car: e.abilityScores.car,
      }
    : { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };

  const actions: StatBlockEntry[] = [];
  const atkMod = formatModifier(e.attackBonus);
  const dmgBonus = e.damageBonus > 0
    ? ` + ${e.damageBonus}`
    : e.damageBonus < 0 ? ` ${e.damageBonus}` : '';
  const dmgType = e.attackDamageType ?? 'físico';
  actions.push({
    name: 'Ataque',
    description: `Ataque corpo-a-corpo: ${atkMod} para acertar. Dano: ${e.damageDice}${dmgBonus} de dano ${dmgType}.`,
  });

  return {
    name: e.name,
    type: e.isBoss ? 'criatura única' : 'criatura',
    ac: e.armorClass,
    hp: e.currentHp,
    maxHp: e.maxHp,
    speed: '9m',
    abilities,
    damageResistances: e.resistances?.map((r) => String(r)),
    damageImmunities: e.immunities?.map((r) => String(r)),
    damageVulnerabilities: e.vulnerabilities?.map((r) => String(r)),
    xp: e.xpAward,
    actions,
    traits: e.description
      ? [{ name: 'Descrição', description: e.description }]
      : undefined,
  };
}

// Converte NpcMemory → StatBlockData minimal (NPCs Met são "fichas conhecidas",
// sem stats reais; mostra arquétipo + atitude como traits flavor).
export function npcToStatBlock(n: NpcMemory): StatBlockData {
  return {
    name: n.name,
    type: n.archetype,
    ac: 10,
    hp: 0,
    hpFormula: '—',
    speed: '9m',
    abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    traits: [
      { name: 'Atitude', description: attitudeText(n.attitude) },
      ...(n.notes ? [{ name: 'Notas', description: n.notes }] : []),
    ],
  };
}

function attitudeText(att: NpcMemory['attitude']): string {
  switch (att) {
    case 'amigavel':   return 'Amigável. Disposto a ajudar a party.';
    case 'neutro':     return 'Neutro. Comportamento depende da abordagem.';
    case 'hostil':     return 'Hostil. Já mostrou desprezo pela party.';
    case 'misterioso': return 'Misterioso. Intenções obscuras.';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Render
// ════════════════════════════════════════════════════════════════════════════

export function renderStatBlock(data: StatBlockData): HTMLElement {
  const block = el('div', { class: 'stat-block', attrs: { role: 'region', 'aria-label': `Stat block de ${data.name}` } });

  // ── Header ───────────────────────────────────────────────────────────
  block.appendChild(renderHeader(data));

  // ── Régua superior (sangue) ──────────────────────────────────────────
  block.appendChild(el('div', { class: 'stat-block-rule' }));

  // ── AC / HP / Speed ──────────────────────────────────────────────────
  block.appendChild(renderBasics(data));

  // ── Régua ────────────────────────────────────────────────────────────
  block.appendChild(el('div', { class: 'stat-block-rule' }));

  // ── Ability scores grid 6-col ────────────────────────────────────────
  block.appendChild(renderAbilities(data.abilities));

  // ── Régua ────────────────────────────────────────────────────────────
  block.appendChild(el('div', { class: 'stat-block-rule' }));

  // ── Details (saves, skills, senses, langs, CR) ───────────────────────
  const details = renderDetails(data);
  if (details) {
    block.appendChild(details);
    block.appendChild(el('div', { class: 'stat-block-rule' }));
  }

  // ── Traits ───────────────────────────────────────────────────────────
  if (data.traits && data.traits.length > 0) {
    block.appendChild(renderEntryList('', data.traits));
  }

  // ── Actions ──────────────────────────────────────────────────────────
  if (data.actions && data.actions.length > 0) {
    block.appendChild(renderSectionTitle('Ações'));
    block.appendChild(renderEntryList('actions', data.actions));
  }

  // ── Reactions ────────────────────────────────────────────────────────
  if (data.reactions && data.reactions.length > 0) {
    block.appendChild(renderSectionTitle('Reações'));
    block.appendChild(renderEntryList('reactions', data.reactions));
  }

  // ── Legendary Actions ────────────────────────────────────────────────
  if (data.legendaryActions && data.legendaryActions.length > 0) {
    block.appendChild(renderSectionTitle('Ações Lendárias'));
    block.appendChild(renderEntryList('legendary', data.legendaryActions));
  }

  return block;
}

function renderHeader(data: StatBlockData): HTMLElement {
  const head = el('div', { class: 'stat-block-head' });
  head.appendChild(el('h2', { class: 'stat-block-name', text: data.name }));
  const subParts: string[] = [];
  if (data.size) subParts.push(sizeLabel(data.size));
  if (data.type) subParts.push(data.type);
  if (subParts.length > 0) {
    const subline = subParts.join(', ') + (data.alignment ? `, ${data.alignment}` : '');
    head.appendChild(el('div', { class: 'stat-block-subtype', text: subline }));
  } else if (data.alignment) {
    head.appendChild(el('div', { class: 'stat-block-subtype', text: data.alignment }));
  }
  return head;
}

function renderBasics(data: StatBlockData): HTMLElement {
  const basics = el('div', { class: 'stat-block-basics' });
  basics.appendChild(renderKv('Classe de Armadura', `${data.ac}${data.acSource ? ` (${data.acSource})` : ''}`));
  const hpText = data.maxHp != null && data.maxHp !== data.hp
    ? `${data.hp}/${data.maxHp}`
    : data.hpFormula
      ? `${data.hp} (${data.hpFormula})`
      : String(data.hp);
  basics.appendChild(renderKv('Pontos de Vida', hpText));
  basics.appendChild(renderKv('Deslocamento', data.speed));
  return basics;
}

function renderAbilities(ab: StatBlockAbilities): HTMLElement {
  const grid = el('div', { class: 'stat-block-abilities' });
  const order: Array<[keyof StatBlockAbilities, string]> = [
    ['for', 'FOR'], ['des', 'DES'], ['con', 'CON'],
    ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR'],
  ];
  for (const [key, label] of order) {
    const score = ab[key];
    const mod = abilityModifier(score);
    grid.appendChild(el('div', { class: 'stat-block-ability' }, [
      el('div', { class: 'stat-block-ability-label', text: label }),
      el('div', { class: 'stat-block-ability-score', text: `${score} (${formatModifier(mod)})` }),
    ]));
  }
  return grid;
}

function renderDetails(data: StatBlockData): HTMLElement | null {
  const items: HTMLElement[] = [];
  const push = (label: string, value: string | undefined): void => {
    if (value && value.trim()) {
      items.push(renderKv(label, value));
    }
  };
  push('Testes de Resistência', data.savingThrows?.join(', '));
  push('Perícias', data.skills?.join(', '));
  push('Vulnerabilidades a Dano', data.damageVulnerabilities?.join(', '));
  push('Resistências a Dano', data.damageResistances?.join(', '));
  push('Imunidades a Dano', data.damageImmunities?.join(', '));
  push('Imunidades a Condição', data.conditionImmunities?.join(', '));
  push('Sentidos', data.senses);
  push('Idiomas', data.languages);
  if (data.cr != null && data.cr.trim()) {
    const xp = data.xp ?? crToXp(data.cr);
    push('Nível de Desafio', `${data.cr} (${xp} XP)`);
  }
  if (items.length === 0) return null;
  const wrap = el('div', { class: 'stat-block-details' });
  for (const it of items) wrap.appendChild(it);
  return wrap;
}

function renderKv(label: string, value: string): HTMLElement {
  return el('div', { class: 'stat-block-kv' }, [
    el('span', { class: 'stat-block-kv-label', text: `${label}.` }),
    el('span', { class: 'stat-block-kv-value', text: ` ${value}` }),
  ]);
}

function renderSectionTitle(title: string): HTMLElement {
  return el('h3', { class: 'stat-block-section', text: title });
}

function renderEntryList(_kind: string, entries: StatBlockEntry[]): HTMLElement {
  const wrap = el('div', { class: 'stat-block-entries' });
  for (const e of entries) {
    const item = el('div', { class: 'stat-block-entry' });
    item.innerHTML = `<span class="stat-block-entry-name">${escapeHtml(e.name)}.</span> <span class="stat-block-entry-desc">${escapeHtml(e.description)}</span>`;
    wrap.appendChild(item);
  }
  return wrap;
}
