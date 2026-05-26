// JSgame · F33 — Live preview lateral.
// Mini-ficha do PJ em construção, visível em todos os steps do wizard.
// Em desktop fica sticky lateral, em mobile vira drawer colapsável no topo.

import { getRace } from '../../dnd/races';
import { getClass } from '../../dnd/classes';
import { getBackground } from '../../dnd/backgrounds';
import { getSubclass } from '../../dnd/subclasses';
import { getSkill } from '../../dnd/skills';
import {
  ABILITY_KEYS, ABILITY_SHORT,
  abilityModifier, formatModifier, applyRacialBonuses, totalPointBuyCost,
  POINT_BUY_BUDGET,
} from '../../dnd/attributes';
import { startingHitPoints } from '../../dnd/classes';
import { portraitFor } from '../../dnd/portrait';
import { el } from '../util';
import type { WizardState } from './wizard';

export function renderLivePreview(state: WizardState): HTMLElement {
  const root = el('aside', { class: 'wiz-live-preview', attrs: { 'aria-label': 'Ficha em construção' } });

  // Toggle (mobile collapse). Em desktop, CSS força always-open.
  const headerBtn = el('button', {
    class: 'wlp-toggle',
    attrs: { type: 'button' },
    on: {
      click: () => root.classList.toggle('is-collapsed'),
    },
  });
  headerBtn.innerHTML = '<span class="wlp-toggle-label">📜 Sua ficha em tempo real</span><span class="wlp-toggle-chevron">▾</span>';
  root.appendChild(headerBtn);

  const body = el('div', { class: 'wlp-body' });

  // Portrait (visível só quando tem race+class)
  if (state.raceId && state.classId) {
    const p = portraitFor({ raceId: state.raceId, classId: state.classId });
    body.appendChild(el('div', { class: 'wlp-portrait', style: { background: p.aura } }, [
      el('span', { class: 'wlp-portrait-race', text: p.race }),
      el('span', { class: 'wlp-portrait-class', text: p.class }),
    ]));
  } else {
    body.appendChild(el('div', { class: 'wlp-portrait wlp-portrait-empty' }, [
      el('span', { text: '?' }),
    ]));
  }

  // Headline (nome + race + class)
  const race = state.raceId ? getRace(state.raceId) : null;
  const klass = state.classId ? getClass(state.classId) : null;
  const subclass = state.subclassId ? getSubclass(state.subclassId) : null;
  body.appendChild(el('div', { class: 'wlp-headline' }, [
    el('div', { class: 'wlp-name', text: state.characterName.trim() || 'Sem nome' }),
    el('div', { class: 'wlp-meta', text: [
      race?.name ?? '— raça',
      klass?.name ?? '— classe',
      subclass?.name,
    ].filter(Boolean).join(' · ') }),
  ]));

  // Ability scores (mostra só quando tem race; sem race não vê racial bonus)
  if (race) {
    const finalScores = applyRacialBonuses(state.abilityScoresBase, race.abilityBonuses);
    const abGrid = el('div', { class: 'wlp-ab-grid' });
    for (const key of ABILITY_KEYS) {
      const score = finalScores[key];
      const mod = abilityModifier(score);
      abGrid.appendChild(el('div', { class: 'wlp-ab' }, [
        el('span', { class: 'wlp-ab-key', text: ABILITY_SHORT[key] }),
        el('span', { class: 'wlp-ab-val', text: String(score) }),
        el('span', { class: 'wlp-ab-mod', text: formatModifier(mod) }),
      ]));
    }
    body.appendChild(abGrid);

    // Point buy status — só relevante até passar o step
    if (state.step === 'abilities') {
      const cost = totalPointBuyCost(state.abilityScoresBase) ?? POINT_BUY_BUDGET;
      const remaining = POINT_BUY_BUDGET - cost;
      body.appendChild(el('div', {
        class: `wlp-pointbuy ${remaining < 0 ? 'is-over' : ''}`,
        text: `${remaining}/${POINT_BUY_BUDGET} pts restantes`,
      }));
    }
  }

  // HP + AC stats (precisa de race + class)
  if (race && klass) {
    const finalScores = applyRacialBonuses(state.abilityScoresBase, race.abilityBonuses);
    const conMod = abilityModifier(finalScores.con);
    const dexMod = abilityModifier(finalScores.des);
    const hp = startingHitPoints(state.classId!, conMod);
    const ac = 10 + dexMod;
    body.appendChild(el('div', { class: 'wlp-stats' }, [
      el('div', { class: 'wlp-stat' }, [
        el('span', { class: 'wlp-stat-key', text: 'HP' }),
        el('span', { class: 'wlp-stat-val', text: String(hp) }),
      ]),
      el('div', { class: 'wlp-stat' }, [
        el('span', { class: 'wlp-stat-key', text: 'CA' }),
        el('span', { class: 'wlp-stat-val', text: String(ac) }),
      ]),
      el('div', { class: 'wlp-stat' }, [
        el('span', { class: 'wlp-stat-key', text: 'VEL' }),
        el('span', { class: 'wlp-stat-val', text: `${race.speed}ft` }),
      ]),
    ]));
  }

  // Background + skills resumo
  if (state.backgroundId) {
    const bg = getBackground(state.backgroundId);
    body.appendChild(el('div', { class: 'wlp-bg-row' }, [
      el('span', { class: 'wlp-bg-key', text: 'Antecedente:' }),
      el('span', { class: 'wlp-bg-val', text: bg.name }),
    ]));
  }
  if (state.chosenSkills.length > 0 || state.backgroundId) {
    const bg = state.backgroundId ? getBackground(state.backgroundId) : null;
    const allSkills = Array.from(new Set([
      ...(bg?.skillProficiencies ?? []),
      ...state.chosenSkills,
    ]));
    if (allSkills.length > 0) {
      body.appendChild(el('div', { class: 'wlp-skills' }, [
        el('span', { class: 'wlp-skills-key', text: 'Perícias:' }),
        el('span', { class: 'wlp-skills-val', text: allSkills.map((s) => getSkill(s).name).join(', ') }),
      ]));
    }
  }

  // Mostra hint do que falta (ordem do wizard)
  const missing: string[] = [];
  if (!state.raceId) missing.push('raça');
  if (!state.classId) missing.push('classe');
  if (!state.backgroundId) missing.push('antecedente');
  if (missing.length > 0) {
    body.appendChild(el('div', { class: 'wlp-missing' }, [
      el('span', { class: 'wlp-missing-key', text: 'Falta:' }),
      el('span', { class: 'wlp-missing-val', text: missing.join(' · ') }),
    ]));
  } else {
    body.appendChild(el('div', { class: 'wlp-ready', text: '✓ Tudo pronto pra revisão' }));
  }

  root.appendChild(body);
  return root;
}
