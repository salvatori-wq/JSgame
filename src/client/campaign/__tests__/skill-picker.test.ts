// Sub-sprint D2 — Tests dos helpers puros do skill-picker.

import { describe, it, expect } from 'vitest';
import { listSkillsForPicker } from '../skill-picker';
import { SKILLS } from '../../../dnd/skills';

describe('D2 — listSkillsForPicker', () => {
  it('retorna todas as 18 perícias D&D 5e', () => {
    const opts = listSkillsForPicker();
    expect(opts.length).toBe(Object.keys(SKILLS).length);
    expect(opts.length).toBe(18);
  });

  it('Percepção é a primeira (mais comum em D&D)', () => {
    const opts = listSkillsForPicker();
    expect(opts[0]?.value).toBe('percepcao');
  });

  it('5 perícias mais comuns aparecem no início (ergonomia)', () => {
    const opts = listSkillsForPicker();
    const firstFive = opts.slice(0, 5).map((o) => o.value);
    expect(firstFive).toContain('percepcao');
    expect(firstFive).toContain('investigacao');
    expect(firstFive).toContain('persuasao');
    expect(firstFive).toContain('atletismo');
    expect(firstFive).toContain('furtividade');
  });

  it('description começa com ATRIBUTO uppercase (FOR/DES/CON/INT/SAB/CAR)', () => {
    const opts = listSkillsForPicker();
    for (const o of opts) {
      expect(o.description).toMatch(/^(FOR|DES|CON|INT|SAB|CAR) ·/);
    }
  });

  it('value bate com SkillId válido em SKILLS', () => {
    const opts = listSkillsForPicker();
    for (const o of opts) {
      expect(SKILLS[o.value]).toBeDefined();
      expect(SKILLS[o.value].name).toBe(o.label);
    }
  });

  it('sem duplicatas', () => {
    const opts = listSkillsForPicker();
    const values = opts.map((o) => o.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
