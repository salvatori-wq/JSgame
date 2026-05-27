// F2 — Tests pro enrichAttackLog + buildKoNarration.

import { describe, it, expect } from 'vitest';
import { enrichAttackLog, buildKoNarration } from '../combat-narrator';

describe('enrichAttackLog', () => {
  it('hit normal gera frase com attacker, target, roll, dmg', () => {
    const log = enrichAttackLog({
      attackerName: 'Borin', targetName: 'Goblin',
      attackRoll: 14, targetAc: 13,
      hit: true, crit: false, nat1: false,
      damage: 5, killed: false,
      seed: 0, // verb determinístico = "cravou em"
    });
    expect(log).toContain('Borin');
    expect(log).toContain('Goblin');
    expect(log).toContain('5 dmg');
    expect(log).toContain('cravou em');
  });

  it('crit usa verbo UPPERCASE forte', () => {
    const log = enrichAttackLog({
      attackerName: 'Borin', targetName: 'Goblin',
      attackRoll: 20, targetAc: 13,
      hit: true, crit: true, nat1: false,
      damage: 12, killed: false,
      seed: 0,
    });
    expect(log).toContain('NAT20');
    expect(log).toMatch(/ESMAGOU|DILACEROU|DEMOLIU|DECEPOU|ANIQUILOU|DESTRUIU/);
    // Não deveria ter "vs CA" — crit ignora AC display
    expect(log).not.toContain('vs CA');
  });

  it('miss usa verbo de erro', () => {
    const log = enrichAttackLog({
      attackerName: 'Borin', targetName: 'Goblin',
      attackRoll: 8, targetAc: 15,
      hit: false, crit: false, nat1: false,
      damage: 0, killed: false,
      seed: 0,
    });
    expect(log).toContain('8 vs CA 15');
    expect(log).toMatch(/errou|passou raspando|sem efeito|bloqueado|falhou/);
  });

  it('nat1 usa verbo de tropeço, sem AC display', () => {
    const log = enrichAttackLog({
      attackerName: 'Borin', targetName: 'Goblin',
      attackRoll: 1, targetAc: 15,
      hit: false, crit: false, nat1: true,
      damage: 0, killed: false,
      seed: 0,
    });
    expect(log).toContain('NAT1');
    expect(log).toMatch(/tropeçou|errou feio|equilíbrio|miseravelmente/);
  });

  it('kill adiciona suffix narrativo', () => {
    const log = enrichAttackLog({
      attackerName: 'Borin', targetName: 'Goblin',
      attackRoll: 14, targetAc: 13,
      hit: true, crit: false, nat1: false,
      damage: 7, killed: true,
      seed: 0,
    });
    expect(log).toMatch(/cai morto|tomba sem vida|desaba|arremessado/);
    expect(log).toContain('Goblin');
  });

  it('seed determinístico — mesma seed mesma frase', () => {
    const opts = {
      attackerName: 'A', targetName: 'B',
      attackRoll: 14, targetAc: 13,
      hit: true, crit: false, nat1: false,
      damage: 5, killed: false,
      seed: 7,
    };
    const log1 = enrichAttackLog(opts);
    const log2 = enrichAttackLog(opts);
    expect(log1).toBe(log2);
  });

  it('seeds diferentes geram frases diferentes (probabilísticamente)', () => {
    const base = {
      attackerName: 'A', targetName: 'B',
      attackRoll: 14, targetAc: 13,
      hit: true, crit: false, nat1: false,
      damage: 5, killed: false,
    };
    const logs = new Set<string>();
    for (let s = 0; s < 6; s++) {
      logs.add(enrichAttackLog({ ...base, seed: s }));
    }
    expect(logs.size).toBeGreaterThan(1);
  });
});

describe('buildKoNarration', () => {
  it('substitui {name} pelo char name', () => {
    const narr = buildKoNarration('Borin', 0);
    expect(narr).toContain('Borin');
    expect(narr).not.toContain('{name}');
  });

  it('narração é dramática (não "Borin caiu")', () => {
    const narr = buildKoNarration('Borin', 0);
    expect(narr.length).toBeGreaterThan(20);
    expect(narr.toLowerCase()).toMatch(/desaba|tomba|escurece|arremessado|sopro|sangue/);
  });

  it('seed determinístico', () => {
    expect(buildKoNarration('X', 0)).toBe(buildKoNarration('X', 0));
  });

  it('4 templates disponíveis (variação real)', () => {
    const narrs = new Set<string>();
    for (let s = 0; s < 4; s++) {
      narrs.add(buildKoNarration('X', s));
    }
    expect(narrs.size).toBe(4);
  });
});
