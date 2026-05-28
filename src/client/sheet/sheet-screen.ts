// JSgame · F32 — Character sheet completo (PHB-like).
// Página dedicada com todos os stats. Compatível com print (@media print).

import type { CharacterSheet } from '../../shared/types';
import { el, escapeHtml } from '../util';
import { getCharacter } from '../api';
import { getRace } from '../../dnd/races';
import { getClass } from '../../dnd/classes';
import { getBackground } from '../../dnd/backgrounds';
import { ABILITY_KEYS, ABILITY_LABELS, ABILITY_SHORT, abilityModifier, formatModifier, proficiencyBonus } from '../../dnd/attributes';
import { SKILLS, type SkillId } from '../../dnd/skills';
import { portraitFor } from '../../dnd/portrait';
import { getSpell } from '../../dnd/spells';
import { effectiveLevel } from '../../dnd/multiclass';
import { xpProgressInLevel, xpToNextLevel, XP_FOR_LEVEL } from '../../dnd/leveling';

interface Opts {
  container: HTMLElement;
  characterId: string;
  onExit: () => void;
}

export class SheetScreen {
  private container: HTMLElement;
  private opts: Opts;

  constructor(opts: Opts) {
    this.container = opts.container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.container.innerHTML = '';
    const loading = el('div', { class: 'sheet-loading', text: 'Carregando ficha…' });
    this.container.appendChild(loading);
    try {
      const sheet = await getCharacter(this.opts.characterId);
      this.container.innerHTML = '';
      this.container.appendChild(this.renderSheet(sheet));
    } catch (err) {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', { class: 'sheet-error', text: `Erro: ${String(err)}` }));
    }
  }

  private renderSheet(sheet: CharacterSheet): HTMLElement {
    const root = el('main', { class: 'sheet-screen' });
    root.appendChild(this.renderHeader(sheet));
    root.appendChild(this.renderTopRow(sheet));
    root.appendChild(this.renderAttributesBlock(sheet));
    root.appendChild(this.renderSkillsBlock(sheet));
    root.appendChild(this.renderCombatBlock(sheet));
    if (this.hasSpells(sheet)) root.appendChild(this.renderSpellsBlock(sheet));
    root.appendChild(this.renderInventoryBlock(sheet));
    root.appendChild(this.renderPersonalityBlock(sheet));
    return root;
  }

  private renderHeader(sheet: CharacterSheet): HTMLElement {
    const portrait = portraitFor({ raceId: sheet.raceId, classId: sheet.classId });
    const race = getRace(sheet.raceId);
    const klass = getClass(sheet.classId);
    const bg = getBackground(sheet.backgroundId);

    // Multi-class display
    const additional = sheet.additionalClasses ?? [];
    const totalLevel = effectiveLevel([
      { classId: sheet.classId, level: sheet.level },
      ...additional.map((c) => ({ classId: c.classId, level: c.level })),
    ]);
    const classStr = additional.length > 0
      ? `${klass.name} ${sheet.level}/${additional.map((c) => `${getClass(c.classId).name} ${c.level}`).join('/')}`
      : `${klass.name} ${sheet.level}`;

    return el('header', { class: 'sheet-header' }, [
      el('button', {
        class: 'sheet-back wiz-back-btn no-print',
        text: '← Voltar',
        attrs: { type: 'button' },
        on: { click: () => this.opts.onExit() },
      }),
      el('div', { class: 'sheet-portrait', style: { background: portrait.aura } }, [
        el('span', { class: 'sheet-portrait-race', text: portrait.race }),
        el('span', { class: 'sheet-portrait-class', text: portrait.class }),
      ]),
      el('div', { class: 'sheet-title-block' }, [
        el('h1', { class: 'sheet-name', text: sheet.characterName }),
        el('div', { class: 'sheet-subtitle', text: `${race.name} · ${classStr} · ${bg.name}` }),
        el('div', { class: 'sheet-meta', text: `Alinhamento: ${sheet.alignment.toUpperCase()} · Total nv ${totalLevel}` }),
      ]),
      el('button', {
        class: 'sheet-print no-print',
        text: '🖨 Imprimir',
        attrs: { type: 'button', title: 'Imprime/exporta PDF da ficha (Ctrl+P)' },
        on: { click: () => window.print() },
      }),
    ]);
  }

  private renderTopRow(sheet: CharacterSheet): HTMLElement {
    const xpPct = Math.round(xpProgressInLevel(sheet.xp, sheet.level) * 100);
    const xpFloor = XP_FOR_LEVEL[sheet.level] ?? 0;
    const xpInLvl = sheet.xp - xpFloor;
    const xpNext = xpToNextLevel(sheet.xp, sheet.level);
    return el('section', { class: 'sheet-top-row' }, [
      el('div', { class: 'sheet-vital sheet-vital-hp' }, [
        el('div', { class: 'sv-label', text: 'HP' }),
        el('div', { class: 'sv-value', text: `${sheet.currentHp}/${sheet.maxHp}` }),
        sheet.tempHp > 0 ? el('div', { class: 'sv-sub', text: `+${sheet.tempHp} temp` }) : null,
      ].filter(Boolean) as HTMLElement[]),
      el('div', { class: 'sheet-vital sheet-vital-ac' }, [
        el('div', { class: 'sv-label', text: 'CA' }),
        el('div', { class: 'sv-value', text: String(sheet.armorClass) }),
      ]),
      el('div', { class: 'sheet-vital sheet-vital-init' }, [
        el('div', { class: 'sv-label', text: 'Iniciativa' }),
        el('div', { class: 'sv-value', text: formatModifier(abilityModifier(sheet.abilityScores.des)) }),
      ]),
      el('div', { class: 'sheet-vital sheet-vital-prof' }, [
        el('div', { class: 'sv-label', text: 'Prof.' }),
        el('div', { class: 'sv-value', text: formatModifier(proficiencyBonus(sheet.level)) }),
      ]),
      el('div', { class: 'sheet-vital sheet-vital-hd' }, [
        el('div', { class: 'sv-label', text: 'Hit Dice' }),
        el('div', { class: 'sv-value', text: `${sheet.hitDiceRemaining}/${sheet.level} d${getClass(sheet.classId).hitDie}` }),
      ]),
      el('div', { class: 'sheet-vital sheet-vital-xp' }, [
        el('div', { class: 'sv-label', text: 'XP' }),
        el('div', { class: 'sv-value', text: sheet.xp.toLocaleString('pt-BR') }),
        el('div', { class: 'sv-xp-bar' }, [
          el('div', { class: 'sv-xp-fill', style: { width: `${xpPct}%` } }),
        ]),
        el('div', { class: 'sv-sub', text: sheet.level >= 20 ? 'MAX' : `${xpInLvl}/${xpInLvl + xpNext} no nv ${sheet.level}` }),
      ]),
    ]);
  }

  private renderAttributesBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: 'Atributos' }));
    const grid = el('div', { class: 'sheet-attrs' });
    for (const key of ABILITY_KEYS) {
      const score = sheet.abilityScores[key];
      const mod = abilityModifier(score);
      grid.appendChild(el('div', { class: 'sheet-attr' }, [
        el('div', { class: 'sa-label', text: ABILITY_SHORT[key] }),
        el('div', { class: 'sa-mod', text: formatModifier(mod) }),
        el('div', { class: 'sa-score', text: String(score) }),
        el('div', { class: 'sa-name', text: ABILITY_LABELS[key] }),
      ]));
    }
    sec.appendChild(grid);

    // T2.1 — Saving throws ganham card visual próprio (sheet-saves-card).
    // Antes: subheader cinza + lista colava no grid de atributos sem distinção.
    // Agora: card com bg/border diferentes — olho separa "atributos" de "saves".
    // Microcopy: "Saving Throws" → "Resistências" (PT-BR consistente com
    // saving-throw-overlay e glossary).
    const savesGrid = el('div', { class: 'sheet-saves sheet-saves-card' });
    savesGrid.appendChild(el('h3', { class: 'sheet-subh', text: '🛡 Resistências' }));
    const savesList = el('div', { class: 'sheet-saves-list' });
    const pb = proficiencyBonus(sheet.level);
    for (const key of ABILITY_KEYS) {
      const score = sheet.abilityScores[key];
      const mod = abilityModifier(score);
      const proficient = sheet.proficientSavingThrows.includes(key);
      const total = mod + (proficient ? pb : 0);
      savesList.appendChild(el('div', { class: `sheet-save ${proficient ? 'is-prof' : ''}` }, [
        el('span', { class: 'ss-dot', text: proficient ? '●' : '○' }),
        el('span', { class: 'ss-name', text: ABILITY_LABELS[key] }),
        el('span', { class: 'ss-mod', text: formatModifier(total) }),
      ]));
    }
    savesGrid.appendChild(savesList);
    sec.appendChild(savesGrid);

    return sec;
  }

  private renderSkillsBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: 'Perícias' }));
    const pb = proficiencyBonus(sheet.level);
    const list = el('div', { class: 'sheet-skills' });
    // Lista todas, ordem alfabética
    const allSkills = Object.values(SKILLS).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    for (const skill of allSkills) {
      const mod = abilityModifier(sheet.abilityScores[skill.ability]);
      const proficient = sheet.proficientSkills.includes(skill.id as SkillId);
      const total = mod + (proficient ? pb : 0);
      list.appendChild(el('div', { class: `sheet-skill ${proficient ? 'is-prof' : ''}` }, [
        el('span', { class: 'sk-dot', text: proficient ? '●' : '○' }),
        el('span', { class: 'sk-name', text: skill.name }),
        el('span', { class: 'sk-ability', text: `(${ABILITY_SHORT[skill.ability]})` }),
        el('span', { class: 'sk-mod', text: formatModifier(total) }),
      ]));
    }
    sec.appendChild(list);
    return sec;
  }

  private renderCombatBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: 'Combate' }));
    const pb = proficiencyBonus(sheet.level);
    const strMod = abilityModifier(sheet.abilityScores.for);
    const dexMod = abilityModifier(sheet.abilityScores.des);

    sec.appendChild(el('div', { class: 'sheet-combat-row' }, [
      el('div', { class: 'sheet-combat-stat' }, [
        el('div', { class: 'sc-label', text: 'Ataque corpo-a-corpo' }),
        el('div', { class: 'sc-value', text: formatModifier(strMod + pb) }),
      ]),
      el('div', { class: 'sheet-combat-stat' }, [
        el('div', { class: 'sc-label', text: 'Ataque à distância' }),
        el('div', { class: 'sc-value', text: formatModifier(dexMod + pb) }),
      ]),
    ]));

    // Conditions
    if (sheet.conditions.length > 0) {
      sec.appendChild(el('div', { class: 'sheet-conds' }, [
        el('h3', { class: 'sheet-subh', text: 'Condições ativas' }),
        el('div', { class: 'sheet-conds-list', text: sheet.conditions.join(', ') }),
      ]));
    }

    // Exhaustion
    if (sheet.exhaustion > 0) {
      sec.appendChild(el('div', { class: 'sheet-exhaustion', text: `Exaustão: ${sheet.exhaustion}/6` }));
    }

    // Death save state (se relevante)
    if (sheet.currentHp <= 0 && (sheet.deathSaveSuccesses > 0 || sheet.deathSaveFailures > 0)) {
      sec.appendChild(el('div', { class: 'sheet-deathsave' }, [
        el('span', { class: 'sd-label', text: '💀 Death Saves' }),
        el('span', { class: 'sd-marks', text: `✓ ${sheet.deathSaveSuccesses}/3 · ✗ ${sheet.deathSaveFailures}/3` }),
      ]));
    }

    // Proficiências
    sec.appendChild(el('div', { class: 'sheet-profs' }, [
      el('h3', { class: 'sheet-subh', text: 'Proficiências' }),
      el('div', { class: 'sheet-prof-row' }, [
        el('span', { class: 'sp-key', text: 'Armaduras:' }),
        el('span', { class: 'sp-val', text: sheet.armorProficiencies.join(', ') || '—' }),
      ]),
      el('div', { class: 'sheet-prof-row' }, [
        el('span', { class: 'sp-key', text: 'Armas:' }),
        el('span', { class: 'sp-val', text: sheet.weaponProficiencies.join(', ') || '—' }),
      ]),
      el('div', { class: 'sheet-prof-row' }, [
        el('span', { class: 'sp-key', text: 'Ferramentas:' }),
        el('span', { class: 'sp-val', text: sheet.toolProficiencies.join(', ') || '—' }),
      ]),
      el('div', { class: 'sheet-prof-row' }, [
        el('span', { class: 'sp-key', text: 'Idiomas:' }),
        el('span', { class: 'sp-val', text: sheet.languages.join(', ') || '—' }),
      ]),
    ]));

    return sec;
  }

  private hasSpells(sheet: CharacterSheet): boolean {
    return sheet.spellsKnown.length > 0 || Object.values(sheet.spellSlots).some((s) => s.max > 0);
  }

  private renderSpellsBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: '🔮 Magias' }));

    // Slots
    const slotsList = el('div', { class: 'sheet-slots' });
    for (let lvl = 1; lvl <= 9; lvl++) {
      const slot = sheet.spellSlots[lvl as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9];
      if (!slot || slot.max === 0) continue;
      const used = slot.used;
      const max = slot.max;
      const pips: HTMLElement[] = [];
      for (let i = 0; i < max; i++) {
        pips.push(el('span', { class: `sheet-slot-pip ${i < (max - used) ? '' : 'is-used'}` }));
      }
      slotsList.appendChild(el('div', { class: 'sheet-slot-row' }, [
        el('span', { class: 'ssr-label', text: `Nv ${lvl}` }),
        el('span', { class: 'ssr-pips' }, pips),
        el('span', { class: 'ssr-count', text: `${max - used}/${max}` }),
      ]));
    }
    if (slotsList.children.length > 0) {
      sec.appendChild(el('h3', { class: 'sheet-subh', text: 'Slots' }));
      sec.appendChild(slotsList);
    }

    // Cantrips e magias por nível
    if (sheet.spellsKnown.length > 0) {
      sec.appendChild(el('h3', { class: 'sheet-subh', text: 'Conhecidas' }));
      const byLevel = new Map<number, string[]>();
      for (const id of sheet.spellsKnown) {
        const spell = getSpell(id as Parameters<typeof getSpell>[0]);
        if (!spell) continue;
        const arr = byLevel.get(spell.level) ?? [];
        arr.push(spell.name);
        byLevel.set(spell.level, arr);
      }
      const levels = [...byLevel.keys()].sort((a, b) => a - b);
      for (const lvl of levels) {
        const names = byLevel.get(lvl) ?? [];
        sec.appendChild(el('div', { class: 'sheet-spell-group' }, [
          el('span', { class: 'sg-lvl', text: lvl === 0 ? 'Truques' : `Nv ${lvl}` }),
          el('span', { class: 'sg-list', text: names.join(', ') }),
        ]));
      }
    }

    return sec;
  }

  private renderInventoryBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: '🎒 Inventário' }));

    sec.appendChild(el('div', { class: 'sheet-inv-gold' }, [
      el('span', { class: 'sig-label', text: 'Ouro:' }),
      el('span', { class: 'sig-val', text: `${sheet.gold} po` }),
    ]));

    if (sheet.inventory.length === 0) {
      sec.appendChild(el('div', { class: 'sheet-inv-empty', text: '🎒 Bolsa vazia. Saqueie ou compre algo decente.' }));
      return sec;
    }

    // Agrupa por type
    const byType = new Map<string, typeof sheet.inventory>();
    for (const item of sheet.inventory) {
      const arr = byType.get(item.type) ?? [];
      arr.push(item);
      byType.set(item.type, arr);
    }
    const typeLabels: Record<string, string> = {
      arma: '⚔ Armas', armadura: '🛡 Armaduras', escudo: '🛡 Escudos',
      consumivel: '🧪 Consumíveis', tesouro: '💎 Tesouros',
      ferramenta: '🔧 Ferramentas', misc: '📦 Misc',
    };
    for (const [type, items] of byType) {
      const label = typeLabels[type] ?? type;
      sec.appendChild(el('div', { class: 'sheet-inv-group' }, [
        el('div', { class: 'sig-type', text: label }),
        el('ul', { class: 'sig-items' }, items.map((it) => el('li', {}, [
          el('span', { class: 'sii-name', text: it.name }),
          it.quantity > 1 ? el('span', { class: 'sii-qty', text: `× ${it.quantity}` }) : null,
          it.description ? el('span', { class: 'sii-desc', text: ` — ${it.description}` }) : null,
        ].filter(Boolean) as HTMLElement[])) as HTMLElement[]),
      ]));
    }

    return sec;
  }

  private renderPersonalityBlock(sheet: CharacterSheet): HTMLElement {
    const sec = el('section', { class: 'sheet-section' });
    sec.appendChild(el('h2', { class: 'sheet-section-h', text: 'Personalidade' }));
    const grid = el('div', { class: 'sheet-personality' });
    if (sheet.personalityTraits.length > 0) {
      grid.appendChild(this.renderPersonalityItem('Traços', sheet.personalityTraits.join(' · ')));
    }
    if (sheet.ideals.length > 0) {
      grid.appendChild(this.renderPersonalityItem('Ideais', sheet.ideals.join(' · ')));
    }
    if (sheet.bonds.length > 0) {
      grid.appendChild(this.renderPersonalityItem('Vínculos', sheet.bonds.join(' · ')));
    }
    if (sheet.flaws.length > 0) {
      grid.appendChild(this.renderPersonalityItem('Falhas', sheet.flaws.join(' · ')));
    }
    sec.appendChild(grid);
    if (sheet.backstory && sheet.backstory.trim().length > 0) {
      sec.appendChild(el('div', { class: 'sheet-backstory' }, [
        el('h3', { class: 'sheet-subh', text: 'História' }),
        el('p', { class: 'sheet-backstory-p', text: sheet.backstory }),
      ]));
    }
    return sec;
  }

  private renderPersonalityItem(label: string, value: string): HTMLElement {
    return el('div', { class: 'sheet-pers-item' }, [
      el('span', { class: 'spi-label', text: label + ':' }),
      el('span', { class: 'spi-val', text: value }),
    ]);
  }
}

// Helper pra escape — usa o já existente
void escapeHtml;
