// JSgame · Step 3: escolha de subclasse (archetype/domain/school/patron).
// PHB padrão: subclass entra em nv 3 (algumas em nv 1/2). Aqui escolhemos
// na criação mesmo — features ficam latentes até o PJ atingir o nível certo.

import { subclassesByClass, type SubclassDef } from '../../dnd/subclasses';
import { getClass } from '../../dnd/classes';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';

export function renderSubclassStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-subclass' });

  if (!state.classId) {
    container.appendChild(el('p', { class: 'wiz-error', text: 'Escolha uma classe antes.' }));
    container.appendChild(el('footer', { class: 'wiz-footer' }, [
      el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    ]));
    return container;
  }

  const klass = getClass(state.classId);
  const options = subclassesByClass(state.classId);

  container.appendChild(el('h2', { class: 'wiz-h2', text: `Escolha sua Subclasse de ${klass.name}` }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'A subclasse define seu arquétipo dentro da classe. Algumas features começam em nv 3, outras vêm depois — você escolhe agora, mas o efeito chega quando subir.' }));

  if (options.length === 0) {
    // Defesa: nenhuma classe deveria ficar sem subclass, mas se acontecer permite seguir.
    container.appendChild(el('p', { class: 'wiz-intro', text: 'Sem subclasses cadastradas pra essa classe ainda. Você pode seguir em frente.' }));
    container.appendChild(el('footer', { class: 'wiz-footer' }, [
      el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
      el('button', {
        class: 'wiz-cta',
        text: 'Continuar →',
        on: { click: () => { callbacks.update({ subclassId: null }); callbacks.next(); } },
      }),
    ]));
    return container;
  }

  const grid = el('div', { class: 'wiz-grid wiz-grid-subclass' });
  for (const sub of options) {
    grid.appendChild(renderSubclassCard(sub, state, callbacks));
  }
  container.appendChild(grid);

  const footer = el('footer', { class: 'wiz-footer' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button', disabled: !state.subclassId },
      on: { click: () => callbacks.next() },
    }),
  ]);
  container.appendChild(footer);

  return container;
}

function renderSubclassCard(
  sub: SubclassDef,
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
): HTMLElement {
  const isSelected = state.subclassId === sub.id;
  const featuresPreview = sub.features
    .filter((f) => f.level <= 6)        // só mostra preview das features de baixo nível
    .map((f) => `<li><b>nv ${f.level}</b> · ${escapeHtml(f.name)}</li>`)
    .join('');

  const card = el('article', {
    class: `wiz-card wiz-card-subclass ${isSelected ? 'is-selected' : ''}`,
    attrs: { role: 'button', tabindex: 0 },
    on: {
      click: () => {
        callbacks.update({ subclassId: sub.id });
        document.dispatchEvent(new CustomEvent('wiz:rerender'));
      },
    },
  });

  card.innerHTML = `
    <div class="wc-name">${escapeHtml(sub.name)}</div>
    <div class="wc-desc">${escapeHtml(sub.description)}</div>
    <ul class="wc-features">${featuresPreview}</ul>
  `;
  return card;
}
