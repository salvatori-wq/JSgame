// JSgame · Client entry point. Router DOM puro.
// Views: home → wizard (criação) → sheet (preview) → campaign (jogo real).

import './styles.css';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet } from '../shared/types';
import { listCharacters, getCharacter, deleteCharacter, getHealth, listCampaigns, type CampaignSummary } from './api';
import { el, getOwnerName, setOwnerName, getLastSession, clearLastSession } from './util';
import { CharacterWizard } from './character-creation/wizard';
import { CampaignScreen } from './campaign/campaign-screen';
import { LobbyScreen } from './lobby/lobby-screen';
import { getRace } from '../dnd/races';
import { getClass } from '../dnd/classes';

const app = document.getElementById('app');
if (!app) throw new Error('#app não existe no DOM');

// === Mobile-first body classes ===
(function applyEnvironmentClasses(): void {
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const narrowScreen = Math.min(window.innerWidth, window.innerHeight) <= 480;
  if (hasCoarsePointer || hasTouch) document.body.classList.add('is-touch');
  if (narrowScreen) document.body.classList.add('is-portrait-narrow');
  document.body.classList.add('vertical-layout');
})();

// === Service Worker (PWA — só em prod, evita conflito com HMR do Vite) ===
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] register failed:', err);
    });
  });
}

// === Socket connect ===
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
});
socket.on('connect', () => console.log('[client] socket connected', socket.id));
socket.on('disconnect', (reason) => console.log('[client] socket disconnected:', reason));

// === Router state ===
type View =
  | { kind: 'home' }
  | { kind: 'wizard'; fromLobby?: boolean }
  | { kind: 'sheet'; id: string }
  | { kind: 'campaign'; characterId: string; campaignId?: string }
  | { kind: 'lobby'; lobbyId?: string };

let currentView: View = { kind: 'home' };
let currentWizard: CharacterWizard | null = null;
let currentCampaign: CampaignScreen | null = null;
let currentLobby: LobbyScreen | null = null;

async function render(): Promise<void> {
  if (currentView.kind !== 'wizard' && currentWizard) {
    currentWizard.destroy();
    currentWizard = null;
  }
  if (currentView.kind !== 'campaign' && currentCampaign) {
    currentCampaign.destroy();
    currentCampaign = null;
  }
  if (currentView.kind !== 'lobby' && currentLobby) {
    currentLobby.destroy();
    currentLobby = null;
  }

  app!.innerHTML = '';

  switch (currentView.kind) {
    case 'home':
      await renderHome();
      break;
    case 'wizard':
      renderWizard(currentView.fromLobby ?? false);
      break;
    case 'sheet':
      await renderSheet(currentView.id);
      break;
    case 'campaign':
      await renderCampaign(currentView.characterId, currentView.campaignId);
      break;
    case 'lobby':
      await renderLobby(currentView.lobbyId);
      break;
  }
}

function navigate(view: View): void {
  currentView = view;
  void render();
}

// === Views ===

async function renderHome(): Promise<void> {
  const owner = getOwnerName();
  const health = await getHealth().catch(() => ({ ok: false } as Awaited<ReturnType<typeof getHealth>>));

  const root = el('main', { class: 'home-screen' });
  root.appendChild(el('header', { class: 'boot-header' }, [
    el('h1', { class: 'boot-title', text: 'JSGAME' }),
    el('div', { class: 'boot-divider' }, [
      el('span', { class: 'bd-line' }),
      el('span', { class: 'bd-glyph', text: '◆' }),
      el('span', { class: 'bd-line' }),
    ]),
    el('p', { class: 'boot-tagline', text: 'D&D 5e Online · Mestre IA · Coop até 3' }),
  ]));

  root.appendChild(el('div', { class: 'boot-status' }, [
    el('div', { class: `bs-row ${health.ok ? 'is-ok' : 'is-fail'}` }, [
      el('span', { class: 'bs-key', text: 'Servidor' }),
      el('span', { class: 'bs-val', text: health.ok ? '✓ online' : '✗ offline' }),
    ]),
    el('div', { class: `bs-row ${health.hasGroq ? 'is-ok' : 'is-warn'}` }, [
      el('span', { class: 'bs-key', text: 'Mestre IA' }),
      el('span', { class: 'bs-val', text: health.hasGroq ? `✓ ${health.dmProvider}` : '⚠ sem GROQ key' }),
    ]),
  ]));

  const ownerInput = el('input', {
    class: 'home-owner-input',
    attrs: { type: 'text', placeholder: 'Seu nome de jogador', maxlength: '32', value: owner },
    on: {
      input: async (e) => {
        setOwnerName((e.target as HTMLInputElement).value);
        await refreshCharsList();
      },
    },
  }) as HTMLInputElement;
  root.appendChild(el('section', {}, [
    el('h3', { class: 'cs-h3', text: 'Quem é você?' }),
    ownerInput,
  ]));

  root.appendChild(el('div', { class: 'home-actions' }, [
    el('button', {
      class: 'home-btn',
      text: '⚔ Novo Personagem',
      on: { click: () => {
        if (!getOwnerName().trim()) {
          ownerInput.focus();
          ownerInput.style.borderColor = 'var(--accent-blood)';
          return;
        }
        navigate({ kind: 'wizard' });
      } },
    }),
  ]));

  const charsContainer = el('section', { class: 'home-chars-container' });
  charsContainer.appendChild(el('h3', { class: 'cs-h3', text: 'Seus Personagens' }));
  const charsList = el('div', { class: 'home-characters' });
  charsContainer.appendChild(charsList);
  root.appendChild(charsContainer);

  // Estado: PJ "selecionado" pra joinar campanhas existentes (default = 1º)
  let selectedCharId: string | null = null;

  const refreshCharsList = async (): Promise<void> => {
    const o = getOwnerName().trim();
    charsList.innerHTML = '';
    if (!o) {
      charsList.appendChild(el('div', { class: 'home-empty', text: 'Digite seu nome pra ver seus personagens.' }));
      return;
    }
    try {
      const chars = await listCharacters(o);
      if (chars.length === 0) {
        charsList.appendChild(el('div', { class: 'home-empty', text: 'Nenhum personagem ainda. Crie o primeiro!' }));
        selectedCharId = null;
        return;
      }
      if (!selectedCharId || !chars.find((c) => c.id === selectedCharId)) {
        selectedCharId = chars[0]?.id ?? null;
      }
      for (const c of chars) {
        const race = getRace(c.raceId as Parameters<typeof getRace>[0]);
        const klass = getClass(c.classId as Parameters<typeof getClass>[0]);
        const isSelected = c.id === selectedCharId;
        const card = el('div', { class: `home-char-card${isSelected ? ' is-selected' : ''}` }, [
          el('div', {
            class: 'hcc-body',
            on: {
              click: () => {
                selectedCharId = c.id;
                void refreshCharsList();
              },
            },
          }, [
            el('div', { class: 'hcc-name', text: c.characterName }),
            el('div', { class: 'hcc-meta', text: `${race?.name ?? c.raceId} · ${klass?.name ?? c.classId} · Nv ${c.level}` }),
          ]),
          el('div', { class: 'hcc-actions' }, [
            el('button', {
              class: 'hcc-play-btn',
              text: '▶ Nova Crônica',
              attrs: { title: 'Começar sessão nova com este PJ' },
              on: {
                click: (e) => {
                  e.stopPropagation();
                  navigate({ kind: 'campaign', characterId: c.id });
                },
              },
            }),
            el('button', {
              class: 'hcc-sheet-btn',
              text: 'Ficha',
              attrs: { title: 'Ver ficha completa' },
              on: {
                click: (e) => {
                  e.stopPropagation();
                  navigate({ kind: 'sheet', id: c.id });
                },
              },
            }),
            el('button', {
              class: 'hcc-del-btn',
              text: '🗑',
              attrs: { title: 'Apagar' },
              on: {
                click: async (e) => {
                  e.stopPropagation();
                  if (confirm(`Apagar ${c.characterName} permanentemente?`)) {
                    await deleteCharacter(c.id);
                    await refreshCharsList();
                  }
                },
              },
            }),
          ]),
        ]);
        charsList.appendChild(card);
      }
    } catch (err) {
      charsList.appendChild(el('div', { class: 'home-empty', text: `Erro: ${String(err)}` }));
    }
  };
  await refreshCharsList();

  // === Coop section: lobby + campanhas em andamento + joinar por código ===
  const coopSection = el('section', { class: 'home-coop' });
  coopSection.appendChild(el('h3', { class: 'cs-h3', text: '🤝 Jogar em Coop' }));

  // ── Lobby pré-jogo (criar PJs juntos)
  const lobbySubsection = el('div', { class: 'home-lobby-subsection' });
  lobbySubsection.appendChild(el('p', { class: 'home-coop-hint', text: '🏛 Lobby pré-jogo — crie/escolha PJs juntos antes de começar.' }));
  const lobbyJoinInput = el('input', {
    class: 'home-join-input',
    attrs: { type: 'text', placeholder: 'Código do lobby (6 chars)', maxlength: '8' },
  }) as HTMLInputElement;
  const lobbyJoinBtn = el('button', {
    class: 'home-join-btn',
    text: '🔗 Joinar Lobby',
    on: {
      click: () => {
        if (!getOwnerName().trim()) { alert('Digite seu nome de jogador antes.'); return; }
        const id = lobbyJoinInput.value.trim();
        if (!id) { lobbyJoinInput.focus(); return; }
        navigate({ kind: 'lobby', lobbyId: id });
      },
    },
  });
  const lobbyCreateBtn = el('button', {
    class: 'home-join-btn home-create-lobby-btn',
    text: '🏛 Criar Lobby',
    on: {
      click: () => {
        if (!getOwnerName().trim()) { alert('Digite seu nome de jogador antes.'); return; }
        navigate({ kind: 'lobby' });
      },
    },
  });
  lobbySubsection.appendChild(el('div', { class: 'home-lobby-actions' }, [
    lobbyCreateBtn,
    el('div', { class: 'home-join-row' }, [lobbyJoinInput, lobbyJoinBtn]),
  ]));
  coopSection.appendChild(lobbySubsection);

  // Divisor
  coopSection.appendChild(el('div', { class: 'home-coop-divider', text: '— OU —' }));

  coopSection.appendChild(el('p', { class: 'home-coop-hint', text: '↓ Joinar crônica já em andamento (precisa do código da crônica).' }));

  // Lista campanhas recentes
  const campsList = el('div', { class: 'home-camps' });
  coopSection.appendChild(campsList);

  const refreshCamps = async (): Promise<void> => {
    campsList.innerHTML = '';
    try {
      const camps = await listCampaigns();
      if (camps.length === 0) {
        campsList.appendChild(el('div', { class: 'home-empty', text: 'Nenhuma crônica em andamento ainda.' }));
        return;
      }
      for (const c of camps.slice(0, 8)) {
        campsList.appendChild(renderCampaignCard(c, () => selectedCharId, navigate));
      }
    } catch (err) {
      campsList.appendChild(el('div', { class: 'home-empty', text: `Erro listando crônicas: ${String(err)}` }));
    }
  };

  // Input livre pra colar código
  const joinInput = el('input', {
    class: 'home-join-input',
    attrs: { type: 'text', placeholder: 'Cole o código da crônica (ID)', maxlength: '64' },
  }) as HTMLInputElement;
  const joinBtn = el('button', {
    class: 'home-join-btn',
    text: '🔗 Joinar',
    on: {
      click: () => {
        const id = joinInput.value.trim();
        if (!id) { joinInput.focus(); return; }
        if (!selectedCharId) {
          alert('Selecione um personagem primeiro (clique no card).');
          return;
        }
        navigate({ kind: 'campaign', characterId: selectedCharId, campaignId: id });
      },
    },
  });
  coopSection.appendChild(el('div', { class: 'home-join-row' }, [joinInput, joinBtn]));

  root.appendChild(coopSection);
  await refreshCamps();

  app!.appendChild(root);
}

function renderCampaignCard(
  c: CampaignSummary,
  getSelectedChar: () => string | null,
  navigate: (v: { kind: 'campaign'; characterId: string; campaignId?: string }) => void,
): HTMLElement {
  const when = new Date(c.lastPlayedAt);
  const whenStr = when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return el('div', { class: 'home-camp-card' }, [
    el('div', { class: 'hcamp-body' }, [
      el('div', { class: 'hcamp-name', text: c.name }),
      el('div', { class: 'hcamp-meta', text: `Sessão ${c.sessionNumber} · ${whenStr}` }),
      el('div', { class: 'hcamp-id', text: `ID: ${c.id}` }),
    ]),
    el('button', {
      class: 'hcamp-join-btn',
      text: '🤝 Joinar',
      on: {
        click: () => {
          const charId = getSelectedChar();
          if (!charId) { alert('Selecione um personagem primeiro.'); return; }
          navigate({ kind: 'campaign', characterId: charId, campaignId: c.id });
        },
      },
    }),
  ]);
}

function renderWizard(fromLobby: boolean): void {
  const container = el('div', { class: 'wizard-container' });
  app!.appendChild(container);
  currentWizard = new CharacterWizard(
    container,
    (sheet: CharacterSheet) => {
      if (fromLobby) {
        // Quando wizard termina e veio do lobby, marca como ready com o PJ recém-criado
        socket.emit('lobbyUpdateStatus', { status: 'ready', characterId: sheet.id });
        navigate({ kind: 'lobby' });
      } else {
        navigate({ kind: 'home' });
      }
    },
    () => {
      if (fromLobby) navigate({ kind: 'lobby' });
      else navigate({ kind: 'home' });
    },
    fromLobby ? (step: string) => {
      socket.emit('lobbyUpdateStatus', { status: 'wizard', wizardStep: step });
    } : undefined,
  );
  currentWizard.start();
}

async function renderLobby(lobbyId?: string): Promise<void> {
  const container = el('div', { class: 'lobby-container' });
  app!.appendChild(container);
  currentLobby = new LobbyScreen(container, {
    socket,
    ownerName: getOwnerName(),
    onCampaignStart: (campaignId, characterId) => {
      navigate({ kind: 'campaign', characterId, campaignId });
    },
    onCreateCharacter: () => {
      navigate({ kind: 'wizard', fromLobby: true });
    },
    onExit: () => navigate({ kind: 'home' }),
  });
  await currentLobby.start();
  // Se veio com lobbyId, joina; senão, cria lobby
  if (lobbyId) {
    socket.emit('joinLobby', { lobbyId, ownerName: getOwnerName() });
  } else {
    socket.emit('createLobby', { ownerName: getOwnerName() });
  }
}

async function renderSheet(id: string): Promise<void> {
  try {
    const sheet = await getCharacter(id);
    const race = getRace(sheet.raceId);
    const klass = getClass(sheet.classId);

    const root = el('main', { class: 'home-screen' });
    root.appendChild(el('button', {
      class: 'wiz-back-btn',
      text: '← Voltar',
      on: { click: () => navigate({ kind: 'home' }) },
    }));
    root.appendChild(el('h2', { class: 'wiz-h2', text: sheet.characterName }));
    root.appendChild(el('p', { class: 'boot-tagline', text: `${race.name} · ${klass.name} · Nível ${sheet.level}` }));

    root.appendChild(el('div', { class: 'boot-status' }, [
      el('div', { class: 'bs-row is-ok' }, [
        el('span', { class: 'bs-key', text: 'HP' }),
        el('span', { class: 'bs-val', text: `${sheet.currentHp}/${sheet.maxHp}` }),
      ]),
      el('div', { class: 'bs-row is-ok' }, [
        el('span', { class: 'bs-key', text: 'CA' }),
        el('span', { class: 'bs-val', text: String(sheet.armorClass) }),
      ]),
      el('div', { class: 'bs-row is-ok' }, [
        el('span', { class: 'bs-key', text: 'XP' }),
        el('span', { class: 'bs-val', text: String(sheet.xp) }),
      ]),
    ]));

    root.appendChild(el('div', { class: 'home-actions' }, [
      el('button', {
        class: 'home-btn',
        text: '▶ Começar Sessão',
        on: { click: () => navigate({ kind: 'campaign', characterId: id }) },
      }),
    ]));

    app!.appendChild(root);
  } catch (err) {
    app!.innerHTML = `<div class="boot-error">Erro carregando ficha: ${String(err)}</div>`;
  }
}

async function renderCampaign(characterId: string, campaignId?: string): Promise<void> {
  const container = el('div', { class: 'campaign-container' });
  app!.appendChild(container);
  currentCampaign = new CampaignScreen(container, {
    characterId,
    campaignId,
    socket,
    ownerName: getOwnerName(),
    onExit: () => navigate({ kind: 'home' }),
  });
  await currentCampaign.start();
}

// Auto-rejoin: se havia sessão ativa no localStorage, volta direto pra ela.
// Server valida — se PJ/campanha não existe, joinCampaign emit error e usuário cai pro Home via clearLastSession.
const last = getLastSession();
if (last) {
  currentView = { kind: 'campaign', characterId: last.characterId, campaignId: last.campaignId };
}

// Debug helper exposto no console.
(window as unknown as { jsgameClearSession?: () => void }).jsgameClearSession = () => {
  clearLastSession();
  navigate({ kind: 'home' });
};

void render();
