// @vitest-environment happy-dom
// Sprint Φ.2 — Tests do StatBlock component.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderStatBlock,
  abilityModifier,
  formatModifier,
  crToXp,
  sizeLabel,
  enemyToStatBlock,
  npcToStatBlock,
  type StatBlockData,
} from '../stat-block';
import type { EnemySnapshot, NpcMemory } from '../../../shared/types';

function baseData(over: Partial<StatBlockData> = {}): StatBlockData {
  return {
    name: 'Goblin',
    size: 'pequeno',
    type: 'humanoide (goblinoide)',
    alignment: 'neutro mau',
    ac: 15,
    acSource: 'armadura de couro, escudo',
    hp: 7,
    hpFormula: '2d6',
    speed: '9m',
    abilities: { for: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
    cr: '1/4',
    actions: [{ name: 'Cimitarra', description: 'Ataque corpo-a-corpo: +4 para acertar. Dano: 1d6 + 2 cortante.' }],
    ...over,
  };
}

describe('Φ.2 — helpers puros', () => {
  describe('abilityModifier', () => {
    it('calcula mod = floor((score - 10) / 2)', () => {
      expect(abilityModifier(10)).toBe(0);
      expect(abilityModifier(12)).toBe(1);
      expect(abilityModifier(15)).toBe(2);
      expect(abilityModifier(20)).toBe(5);
      expect(abilityModifier(8)).toBe(-1);
      expect(abilityModifier(1)).toBe(-5);
    });
  });

  describe('formatModifier', () => {
    it('prefixa + em positivos, mantém - em negativos, +0 para zero', () => {
      expect(formatModifier(3)).toBe('+3');
      expect(formatModifier(0)).toBe('+0');
      expect(formatModifier(-2)).toBe('-2');
    });
  });

  describe('crToXp', () => {
    it('mapeia CRs comuns', () => {
      expect(crToXp('0')).toBe(10);
      expect(crToXp('1/4')).toBe(50);
      expect(crToXp('1')).toBe(200);
      expect(crToXp('5')).toBe(1800);
      expect(crToXp('30')).toBe(155000);
    });

    it('retorna 0 pra CR desconhecido', () => {
      expect(crToXp('99')).toBe(0);
    });
  });

  describe('sizeLabel', () => {
    it('traduz pra PT-BR sem regressão', () => {
      expect(sizeLabel('minusculo')).toBe('Minúsculo');
      expect(sizeLabel('medio')).toBe('Médio');
      expect(sizeLabel('colossal')).toBe('Colossal');
    });
  });
});

describe('Φ.2 — renderStatBlock', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renderiza nome + subtype com size/type/alignment', () => {
    const block = renderStatBlock(baseData());
    expect(block.querySelector('.stat-block-name')?.textContent).toBe('Goblin');
    const sub = block.querySelector('.stat-block-subtype')?.textContent ?? '';
    expect(sub).toContain('Pequeno');
    expect(sub).toContain('humanoide');
    expect(sub).toContain('neutro mau');
  });

  it('renderiza AC com source + HP com fórmula + Speed', () => {
    const block = renderStatBlock(baseData());
    const basics = block.querySelector('.stat-block-basics')?.textContent ?? '';
    expect(basics).toContain('Classe de Armadura');
    expect(basics).toContain('15');
    expect(basics).toContain('armadura de couro');
    expect(basics).toContain('Pontos de Vida');
    expect(basics).toContain('7 (2d6)');
    expect(basics).toContain('Deslocamento');
    expect(basics).toContain('9m');
  });

  it('renderiza HP atual/máximo quando diferente (combate)', () => {
    const block = renderStatBlock(baseData({ hp: 3, maxHp: 7, hpFormula: undefined }));
    const basics = block.querySelector('.stat-block-basics')?.textContent ?? '';
    expect(basics).toContain('3/7');
  });

  it('renderiza ability scores grid 6-col com modifier formatado', () => {
    const block = renderStatBlock(baseData());
    const abilities = block.querySelectorAll('.stat-block-ability');
    expect(abilities.length).toBe(6);
    const labels = Array.from(block.querySelectorAll('.stat-block-ability-label')).map((n) => n.textContent);
    expect(labels).toEqual(['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']);
    const scores = Array.from(block.querySelectorAll('.stat-block-ability-score')).map((n) => n.textContent);
    expect(scores[0]).toBe('8 (-1)');   // FOR 8
    expect(scores[1]).toBe('14 (+2)');  // DES 14
    expect(scores[2]).toBe('10 (+0)');  // CON 10
  });

  it('renderiza CR com XP derivado automaticamente', () => {
    const block = renderStatBlock(baseData({ cr: '1/4', xp: undefined }));
    const text = block.textContent ?? '';
    expect(text).toContain('Nível de Desafio');
    expect(text).toContain('1/4');
    expect(text).toContain('50 XP');
  });

  it('respeita XP explícito quando fornecido', () => {
    const block = renderStatBlock(baseData({ cr: '1', xp: 999 }));
    const text = block.textContent ?? '';
    expect(text).toContain('999 XP');
  });

  it('renderiza saves + skills + senses + languages quando presentes', () => {
    const block = renderStatBlock(baseData({
      savingThrows: ['DES +5', 'INT +3'],
      skills: ['Furtividade +6'],
      senses: 'visão no escuro 18m, Percepção passiva 9',
      languages: 'comum, goblinoide',
    }));
    const text = block.textContent ?? '';
    expect(text).toContain('Testes de Resistência');
    expect(text).toContain('DES +5');
    expect(text).toContain('Perícias');
    expect(text).toContain('Furtividade +6');
    expect(text).toContain('Sentidos');
    expect(text).toContain('Percepção passiva 9');
    expect(text).toContain('Idiomas');
    expect(text).toContain('goblinoide');
  });

  it('renderiza damage resistances/immunities/vulnerabilities', () => {
    const block = renderStatBlock(baseData({
      damageVulnerabilities: ['fogo'],
      damageResistances: ['cortante de armas não-mágicas'],
      damageImmunities: ['veneno'],
      conditionImmunities: ['envenenado'],
    }));
    const text = block.textContent ?? '';
    expect(text).toContain('Vulnerabilidades a Dano');
    expect(text).toContain('fogo');
    expect(text).toContain('Resistências a Dano');
    expect(text).toContain('Imunidades a Dano');
    expect(text).toContain('Imunidades a Condição');
    expect(text).toContain('envenenado');
  });

  it('renderiza section "Ações" quando data.actions tem entries', () => {
    const block = renderStatBlock(baseData());
    const sections = Array.from(block.querySelectorAll('.stat-block-section'));
    expect(sections.length).toBe(1);
    expect(sections[0]?.textContent).toBe('Ações');
    const entries = block.querySelectorAll('.stat-block-entry');
    expect(entries.length).toBe(1);
    expect(entries[0]?.textContent ?? '').toContain('Cimitarra');
  });

  it('renderiza Reações e Ações Lendárias quando presentes', () => {
    const block = renderStatBlock(baseData({
      reactions: [{ name: 'Aparar', description: 'Adiciona +2 à CA contra um ataque.' }],
      legendaryActions: [{ name: 'Ataque', description: 'Faz uma ação Ataque.' }],
    }));
    const sections = Array.from(block.querySelectorAll('.stat-block-section')).map((s) => s.textContent);
    expect(sections).toEqual(['Ações', 'Reações', 'Ações Lendárias']);
  });

  it('omite sections vazias graciosamente', () => {
    const block = renderStatBlock(baseData({ actions: undefined, reactions: undefined, legendaryActions: undefined }));
    expect(block.querySelectorAll('.stat-block-section').length).toBe(0);
    expect(block.querySelectorAll('.stat-block-entry').length).toBe(0);
  });

  it('renderiza traits sem section header (passive abilities)', () => {
    const block = renderStatBlock(baseData({
      traits: [{ name: 'Fuga Ágil', description: 'O goblin pode usar a ação Esquivar ou Recuar como ação bônus.' }],
      actions: undefined,
    }));
    const entry = block.querySelector('.stat-block-entry');
    expect(entry?.textContent ?? '').toContain('Fuga Ágil');
    // Traits NÃO geram .stat-block-section
    expect(block.querySelectorAll('.stat-block-section').length).toBe(0);
  });

  it('aria-label inclui o nome da criatura', () => {
    const block = renderStatBlock(baseData());
    expect(block.getAttribute('aria-label')).toBe('Stat block de Goblin');
    expect(block.getAttribute('role')).toBe('region');
  });

  it('renderiza alignment-only quando size/type omitidos', () => {
    const block = renderStatBlock(baseData({ size: undefined, type: undefined, alignment: 'caótico bom' }));
    expect(block.querySelector('.stat-block-subtype')?.textContent).toBe('caótico bom');
  });

  it('escapa HTML em entry name/description (xss)', () => {
    const block = renderStatBlock(baseData({
      actions: [{ name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(2)>' }],
    }));
    expect(block.querySelector('script')).toBeNull();
    expect(block.querySelector('img')).toBeNull();
    // Mas o texto literal continua visível
    expect(block.textContent).toContain('<script>');
  });
});

describe('Φ.2 — enemyToStatBlock conversion', () => {
  const baseEnemy: EnemySnapshot = {
    id: 'e1',
    name: 'Esqueleto',
    maxHp: 13,
    currentHp: 8,
    armorClass: 13,
    attackBonus: 4,
    damageDice: '1d6',
    damageBonus: 2,
    initiative: 12,
    conditions: [],
    description: 'Restos animados por magia profana.',
    isBoss: false,
    xpAward: 50,
    resistances: undefined,
    immunities: undefined,
    vulnerabilities: undefined,
    attackDamageType: 'cortante' as never,
    abilityScores: { for: 10, des: 14, con: 15, int: 6, sab: 8, car: 5 },
  };

  it('converte enemy → stat block com abilities, AC, HP atual/max', () => {
    const sb = enemyToStatBlock(baseEnemy);
    expect(sb.name).toBe('Esqueleto');
    expect(sb.ac).toBe(13);
    expect(sb.hp).toBe(8);
    expect(sb.maxHp).toBe(13);
    expect(sb.abilities.des).toBe(14);
    expect(sb.xp).toBe(50);
  });

  it('gera ação "Ataque" a partir do attackBonus/damageDice', () => {
    const sb = enemyToStatBlock(baseEnemy);
    expect(sb.actions?.length).toBe(1);
    const action = sb.actions?.[0];
    expect(action?.name).toBe('Ataque');
    expect(action?.description).toContain('+4');
    expect(action?.description).toContain('1d6');
    expect(action?.description).toContain('+ 2');
  });

  it('usa abilities default 10/10/10/10/10/10 se enemy sem abilityScores', () => {
    const sb = enemyToStatBlock({ ...baseEnemy, abilityScores: undefined });
    expect(sb.abilities).toEqual({ for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 });
  });

  it('inclui descrição como trait quando preenchida', () => {
    const sb = enemyToStatBlock(baseEnemy);
    expect(sb.traits?.[0]?.name).toBe('Descrição');
    expect(sb.traits?.[0]?.description).toContain('magia profana');
  });

  it('mapeia resistances/immunities/vulnerabilities', () => {
    const sb = enemyToStatBlock({
      ...baseEnemy,
      resistances: ['perfurante' as never],
      immunities: ['veneno' as never],
      vulnerabilities: ['contundente' as never],
    });
    expect(sb.damageResistances).toEqual(['perfurante']);
    expect(sb.damageImmunities).toEqual(['veneno']);
    expect(sb.damageVulnerabilities).toEqual(['contundente']);
  });

  it('marca isBoss como "criatura única" no type', () => {
    const sb = enemyToStatBlock({ ...baseEnemy, isBoss: true });
    expect(sb.type).toBe('criatura única');
  });
});

describe('Φ.2 — npcToStatBlock conversion', () => {
  const npc: NpcMemory = {
    id: 'npc1',
    campaignId: 'c1',
    name: 'Bartender Hilda',
    archetype: 'mercador rude',
    attitude: 'neutro',
    firstMet: 0,
    lastSeen: 0,
    lastLocation: 'Taverna do Javali',
    interactionCount: 3,
    notes: 'Deve favor à party',
    relationship: 2,
  };

  it('extrai nome + arquétipo, abilities defaults 10', () => {
    const sb = npcToStatBlock(npc);
    expect(sb.name).toBe('Bartender Hilda');
    expect(sb.type).toBe('mercador rude');
    expect(sb.abilities.for).toBe(10);
  });

  it('inclui Atitude e Notas como traits', () => {
    const sb = npcToStatBlock(npc);
    const traits = sb.traits ?? [];
    expect(traits.length).toBe(2);
    expect(traits[0]?.name).toBe('Atitude');
    expect(traits[0]?.description).toContain('Neutro');
    expect(traits[1]?.name).toBe('Notas');
    expect(traits[1]?.description).toBe('Deve favor à party');
  });

  it('omite trait de Notas quando notes vazias', () => {
    const sb = npcToStatBlock({ ...npc, notes: '' });
    expect(sb.traits?.length).toBe(1);
    expect(sb.traits?.[0]?.name).toBe('Atitude');
  });
});
