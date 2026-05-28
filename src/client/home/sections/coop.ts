// JSgame · Ω.2 — Coop section.
// 2 botões grandes iguais: 🏛 Criar Lobby · 🔗 Joinar Lobby (input revelado on-focus).
// Link colapsável "Joinar crônica em andamento" abaixo (avançado).

import { el, getOwnerName } from '../../util';
import { toastWarn } from '../../toast';
import { focusOwnerInput } from './identity-bar';

export interface CoopOpts {
  identityBar: HTMLElement;
  selectedCharGetter: () => string | null;
  onCreateLobby: () => void;
  onJoinLobby: (lobbyId: string) => void;
  onJoinExisting: (campaignId: string) => void;
}

export function renderCoop(opts: CoopOpts): HTMLElement {
  const section = el('section', { class: 'home-coop-section', attrs: { 'aria-label': 'Jogar em coop' } });
  // Round 1 fix (Henrique) — "lobby" trocado por "sala" no hint (jargão gamer).
  section.appendChild(el('div', { class: 'home-section-header' }, [
    el('span', { class: 'home-section-eyebrow', text: '🤝 JOGAR EM COOP' }),
    el('span', { class: 'home-section-hint', text: 'Até 3 amigos numa sala privada' }),
  ]));

  // 2 botões iguais (grid 50/50)
  const buttons = el('div', { class: 'home-coop-buttons' });

  buttons.appendChild(el('button', {
    class: 'home-coop-btn home-coop-btn-create',
    attrs: { type: 'button', title: 'Crie uma sala — amigos entram com o código' },
    on: {
      click: () => {
        if (!ensureOwner(opts.identityBar)) return;
        opts.onCreateLobby();
      },
    },
  }, [
    el('span', { class: 'home-coop-btn-icon', text: '🏛' }),
    el('span', { class: 'home-coop-btn-label', text: 'Criar Sala' }),
  ]));

  // Joinar Lobby: botão + input revelado on-focus
  const joinBtnWrap = el('div', { class: 'home-coop-join' });
  const lobbyInput = el('input', {
    class: 'home-coop-input',
    attrs: { type: 'text', placeholder: 'Código da sala', maxlength: '8', 'aria-label': 'Código da sala' },
  }) as HTMLInputElement;
  const joinBtn = el('button', {
    class: 'home-coop-btn home-coop-btn-join',
    attrs: { type: 'button', title: 'Cole o código que recebeu de um amigo' },
    on: {
      click: () => {
        if (!ensureOwner(opts.identityBar)) return;
        const id = lobbyInput.value.trim();
        if (!id) { lobbyInput.focus(); return; }
        opts.onJoinLobby(id);
      },
    },
  }, [
    el('span', { class: 'home-coop-btn-icon', text: '🔗' }),
    el('span', { class: 'home-coop-btn-label', text: 'Entrar na Sala' }),
  ]);
  joinBtnWrap.appendChild(lobbyInput);
  joinBtnWrap.appendChild(joinBtn);
  buttons.appendChild(joinBtnWrap);

  section.appendChild(buttons);

  // Link colapsável: joinar crônica em andamento (avançado, input ID longo)
  const advancedToggle = el('button', {
    class: 'home-coop-advanced-toggle',
    text: '↓ Joinar crônica em andamento (com ID)',
    attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'home-coop-advanced' },
  });
  const advancedBody = el('div', {
    class: 'home-coop-advanced',
    attrs: { id: 'home-coop-advanced', 'aria-hidden': 'true' },
  });
  const chronicleInput = el('input', {
    class: 'home-coop-input',
    attrs: { type: 'text', placeholder: 'Cole o ID da crônica', maxlength: '64', 'aria-label': 'ID da crônica' },
  }) as HTMLInputElement;
  const chronicleBtn = el('button', {
    class: 'home-coop-btn-advanced',
    text: 'Joinar Crônica',
    attrs: { type: 'button' },
    on: {
      click: () => {
        const id = chronicleInput.value.trim();
        if (!id) { chronicleInput.focus(); return; }
        const charId = opts.selectedCharGetter();
        if (!charId) {
          toastWarn('Selecione um personagem na lista "Meus PJs" primeiro.');
          return;
        }
        opts.onJoinExisting(id);
      },
    },
  });
  advancedBody.appendChild(chronicleInput);
  advancedBody.appendChild(chronicleBtn);

  advancedToggle.addEventListener('click', () => {
    const open = advancedToggle.getAttribute('aria-expanded') === 'true';
    const next = !open;
    advancedToggle.setAttribute('aria-expanded', String(next));
    advancedToggle.textContent = next ? '↑ Joinar crônica em andamento (com ID)' : '↓ Joinar crônica em andamento (com ID)';
    advancedBody.setAttribute('aria-hidden', String(!next));
    advancedBody.classList.toggle('is-open', next);
  });

  section.appendChild(advancedToggle);
  section.appendChild(advancedBody);
  return section;
}

function ensureOwner(identityBar: HTMLElement): boolean {
  if (!getOwnerName().trim()) {
    focusOwnerInput(identityBar);
    toastWarn('Diga seu nome de jogador antes.');
    return false;
  }
  return true;
}
