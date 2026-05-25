// JSgame · Client entry point. Router DOM puro.
// Views: home → wizard (criação) → sheet (preview) → campaign (jogo real).

import './styles.css';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet } from '@shared/types';
import { listCharacters, getCharacter, deleteCharacter, getHealth } from './api';
import { el, getOwnerName, setOwnerName } from './util';
import { CharacterWizard } from './character-creation/wizard';
import { CampaignScreen } from './campaign/campaign-screen';
import { getRace } from '@dnd/races';
import { getClass } from '@dnd/classes';

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
  | { kind: 'wizard' }
  | { kind: 'sheet'; id: string }
  | { kind: 'campaign'; characterId: string; campaignId?: string };

let currentView: View = { kind: 'home' };
let currentWizard: CharacterWizard | null = null;
let currentCampaign: CampaignScreen | null = null;

async function render(): Promise<void> {
  if (currentView.kind !== 'wizard' && currentWizard) {
    currentWizard.destroy();
    currentWizard = null;
  }
  if (currentView.kind !== 'campaign' && currentCampaign) {
    currentCampaign.destroy();
    currentCampaign = null;
  }

  app!.innerHTML = '';

  switch (currentView.kind) {
    case 'home':
      await renderHome();
      break;
    case 'wizard':
      renderWizard();
      break;
    case 'sheet':
      await renderSheet(currentView.id);
      break;
    case 'campaign':
      await renderCampaign(currentView.characterId, currentView.campaignId);
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
        return;
      }
      for (const c of chars) {
        const race = getRace(c.raceId as Parameters<typeof getRace>[0]);
        const klass = getClass(c.classId as Parameters<typeof getClass>[0]);
        const card = el('div', { class: 'home-char-card' }, [
          el('div', {
            class: 'hcc-body',
            on: { click: () => navigate({ kind: 'sheet', id: c.id }) },
          }, [
            el('div', { class: 'hcc-name', text: c.characterName }),
            el('div', { class: 'hcc-meta', text: `${race?.name ?? c.raceId} · ${klass?.name ?? c.classId} · Nv ${c.level}` }),
          ]),
          el('div', { class: 'hcc-actions' }, [
            el('button', {
              class: 'hcc-play-btn',
              text: '▶ Jogar',
              attrs: { title: 'Começar / continuar sessão' },
              on: {
                click: (e) => {
                  e.stopPropagation();
                  navigate({ kind: 'campaign', characterId: c.id });
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

  app!.appendChild(root);
}

function renderWizard(): void {
  const container = el('div', { class: 'wizard-container' });
  app!.appendChild(container);
  currentWizard = new CharacterWizard(
    container,
    (_sheet: CharacterSheet) => navigate({ kind: 'home' }),
    () => navigate({ kind: 'home' }),
  );
  currentWizard.start();
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

void render();
