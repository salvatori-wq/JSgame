// @vitest-environment happy-dom
// Fase 1B — Retrato medalhão dos prefabs (classe SVG + aura + raça).

import { describe, it, expect } from 'vitest';
import { renderPrefabPortrait } from '../prefab-portrait';
import { PREFAB_CARDS } from '../sections/play-now';
import { buildPrefabCharacter } from '../../../dnd/prefab-characters';

describe('renderPrefabPortrait', () => {
  it('produz medalhão com aura da classe + ícone SVG + badge de raça', () => {
    const p = renderPrefabPortrait({ raceId: 'alto-elfo', classId: 'mago', ariaLabel: 'Lyra' });
    expect(p.classList.contains('pf-portrait')).toBe(true);
    expect(p.getAttribute('style') ?? '').toContain('--pf-aura:');
    expect(p.querySelector('.pf-portrait-class svg')).toBeTruthy();  // mago → pointy-hat SVG
    expect(p.querySelector('.pf-portrait-race')?.textContent).toBeTruthy();
    expect(p.getAttribute('aria-label')).toBe('Lyra');
  });

  it('aceita className extra (home-prefab-icon)', () => {
    const p = renderPrefabPortrait({ raceId: 'anao-montanha', classId: 'guerreiro', className: 'home-prefab-icon' });
    expect(p.classList.contains('home-prefab-icon')).toBe(true);
    expect(p.classList.contains('pf-portrait')).toBe(true);
  });

  it('classes diferentes → ícones diferentes (medalhões distintos)', () => {
    const mago = renderPrefabPortrait({ raceId: 'alto-elfo', classId: 'mago' });
    const guerreiro = renderPrefabPortrait({ raceId: 'anao-montanha', classId: 'guerreiro' });
    const magoIcon = mago.querySelector('.pf-portrait-class')?.innerHTML;
    const guerreiroIcon = guerreiro.querySelector('.pf-portrait-class')?.innerHTML;
    expect(magoIcon).toBeTruthy();
    expect(magoIcon).not.toBe(guerreiroIcon);
  });

  it('aura distinta por classe', () => {
    const mago = renderPrefabPortrait({ raceId: 'alto-elfo', classId: 'mago' });
    const ladino = renderPrefabPortrait({ raceId: 'halfling-pes-leve', classId: 'ladino' });
    expect(mago.getAttribute('style')).not.toBe(ladino.getAttribute('style'));
  });
});

describe('PREFAB_CARDS — raceId/classId batem com o builder real', () => {
  it('cada card tem raceId/classId iguais ao CharacterSheet construído', () => {
    for (const card of PREFAB_CARDS) {
      const sheet = buildPrefabCharacter(card.id);
      expect(card.raceId).toBe(sheet.raceId);
      expect(card.classId).toBe(sheet.classId);
    }
  });
});
