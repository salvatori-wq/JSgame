// JSgame · F23 — Barra de Class Features Big 7 na combat screen.
// Renderiza botões dinâmicos baseados na classe + nível do PJ.
// Exibe uses restantes e tooltip de descrição.

import type { Socket } from 'socket.io-client';
import type {
  CharacterSheet, ClientToServerEvents, ServerToClientEvents,
} from '../../shared/types';
import { featuresForClass, type FeatureKey } from '../../dnd/class-features';
import { el } from '../util';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export function renderClassFeaturesBar(myChar: CharacterSheet, socket: SocketT, party: CharacterSheet[]): HTMLElement | null {
  const available = featuresForClass(myChar.classId, myChar.level);
  if (available.length === 0) return null;

  const bar = el('div', { class: 'cb-features-bar' });
  bar.appendChild(el('div', { class: 'cb-features-title', text: '⚔ Habilidades de Classe' }));
  const grid = el('div', { class: 'cb-features-grid' });

  for (const def of available) {
    const slot = myChar.classFeatureUses?.[def.key];
    const max = slot?.max ?? 0;
    const used = slot?.used ?? 0;
    const remaining = Math.max(0, max - used);
    const exhausted = remaining <= 0 && max > 0;
    // Bardic Inspiration precisa de target — abre prompt simples.
    const needsTarget = def.key === 'bardic-inspiration';

    const btn = el('button', {
      class: `cb-feature-btn ${exhausted ? 'is-exhausted' : ''}`,
      attrs: {
        type: 'button',
        title: `${def.description}\n\nUsos: ${remaining}/${max} (restaura em ${def.restoreOn === 'short' ? 'descanso curto' : 'descanso longo'})`,
        disabled: exhausted,
      },
      on: {
        click: () => {
          if (exhausted) return;
          if (needsTarget) {
            const allies = party.filter((p) => p.id !== myChar.id && p.currentHp > 0);
            if (allies.length === 0) {
              void import('../toast').then(({ toastWarn }) => toastWarn('Nenhum aliado vivo pra inspirar.'));
              return;
            }
            const choice = prompt(`Inspirar quem? Digite o nome:\n${allies.map((a) => `- ${a.characterName}`).join('\n')}`);
            if (!choice) return;
            const target = allies.find((a) => a.characterName.toLowerCase() === choice.toLowerCase());
            if (!target) {
              void import('../toast').then(({ toastError }) => toastError(`Aliado "${choice}" não encontrado.`));
              return;
            }
            socket.emit('useClassFeature', { feature: def.key, targetId: target.id });
          } else {
            socket.emit('useClassFeature', { feature: def.key });
          }
        },
      },
    }, [
      el('span', { class: 'cbf-icon', text: def.icon }),
      el('span', { class: 'cbf-label', text: def.label }),
      el('span', { class: 'cbf-uses', text: `${remaining}/${max === 999 ? '∞' : max}` }),
    ]);
    grid.appendChild(btn);
  }
  bar.appendChild(grid);
  return bar;
}

export function applicableFeatures(myChar: CharacterSheet): FeatureKey[] {
  return featuresForClass(myChar.classId, myChar.level).map((f) => f.key as FeatureKey);
}
