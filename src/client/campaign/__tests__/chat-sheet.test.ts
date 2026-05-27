// @vitest-environment happy-dom
// ο.2 — Tests do Chat Sheet (party chat).

import { describe, it, expect, beforeEach } from 'vitest';
import { openChatSheet, closeChatSheet, isChatSheetOpen, appendChatMessage, _avatarForTest, _relativeTimeForTest } from '../chat-sheet';
import { resetSheetStackForTest } from '../../sheet-stack-manager';
import { createChatPill } from '../chat-pill';
import type { CharacterSheet } from '../../../shared/types';

function makeCharacter(id: string, overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id,
    ownerName: 'p',
    characterName: id,
    raceId: 'humano',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: 1,
    xp: 0,
    abilityScoresBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    maxHp: 20, currentHp: 20, tempHp: 0, hitDiceRemaining: 1, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: [],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [],
    backstory: '', createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...overrides,
  };
}

describe('Chat Pill ο.2', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('createChatPill renderiza pill com glyph', () => {
    const handle = createChatPill({ unreadCount: 0, onClick: () => {} });
    expect(handle.element.querySelector('.chat-pill-glyph')).toBeTruthy();
  });

  it('badge oculto quando count=0', () => {
    const handle = createChatPill({ unreadCount: 0, onClick: () => {} });
    const badge = handle.element.querySelector('.chat-pill-badge');
    expect(badge?.hasAttribute('hidden')).toBe(true);
  });

  it('setUnreadCount mostra/oculta badge', () => {
    const handle = createChatPill({ unreadCount: 0, onClick: () => {} });
    const badge = handle.element.querySelector('.chat-pill-badge')!;
    handle.setUnreadCount(3);
    expect(badge.hasAttribute('hidden')).toBe(false);
    expect(badge.textContent).toBe('3');
    expect(handle.element.classList.contains('has-unread')).toBe(true);
    handle.setUnreadCount(0);
    expect(badge.hasAttribute('hidden')).toBe(true);
  });

  it('99+ pra count > 99', () => {
    const handle = createChatPill({ unreadCount: 0, onClick: () => {} });
    handle.setUnreadCount(150);
    const badge = handle.element.querySelector('.chat-pill-badge')!;
    expect(badge.textContent).toBe('99+');
  });

  it('click dispara onClick', () => {
    let clicked = 0;
    const handle = createChatPill({ unreadCount: 0, onClick: () => { clicked++; } });
    (handle.element as HTMLButtonElement).click();
    expect(clicked).toBe(1);
  });
});

describe('Chat Sheet ο.2', () => {
  beforeEach(() => {
    resetSheetStackForTest();
    document.body.innerHTML = '';
  });

  it('openChatSheet adiciona sheet com handlebar + header + input', () => {
    openChatSheet({
      party: [makeCharacter('pc-1')],
      messages: [],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    const sheet = document.querySelector('.chat-sheet');
    expect(sheet).toBeTruthy();
    expect(sheet?.querySelector('.cs-handlebar')).toBeTruthy();
    expect(sheet?.querySelector('.cs-header')).toBeTruthy();
    expect(sheet?.querySelector('.cs-input')).toBeTruthy();
    expect(isChatSheetOpen()).toBe(true);
  });

  it('empty state quando sem mensagens', () => {
    openChatSheet({
      party: [makeCharacter('pc-1')],
      messages: [],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    expect(document.querySelector('.cs-empty')).toBeTruthy();
  });

  it('renderiza N mensagens', () => {
    openChatSheet({
      party: [makeCharacter('pc-1'), makeCharacter('pc-2')],
      messages: [
        { id: 'm1', characterId: 'pc-1', speaker: 'pc-1', text: 'oi', timestamp: Date.now() },
        { id: 'm2', characterId: 'pc-2', speaker: 'pc-2', text: 'tudo bem?', timestamp: Date.now() },
      ],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    expect(document.querySelectorAll('.cs-msg').length).toBe(2);
  });

  it('msg do próprio user tem classe is-me', () => {
    openChatSheet({
      party: [makeCharacter('pc-1'), makeCharacter('pc-2')],
      messages: [
        { id: 'm1', characterId: 'pc-1', speaker: 'pc-1', text: 'eu', timestamp: Date.now() },
        { id: 'm2', characterId: 'pc-2', speaker: 'pc-2', text: 'eles', timestamp: Date.now() },
      ],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    const msgs = document.querySelectorAll('.cs-msg');
    expect(msgs[0]?.classList.contains('is-me')).toBe(true);
    expect(msgs[1]?.classList.contains('is-me')).toBe(false);
  });

  it('send button dispara onSend com texto', () => {
    let received: string | null = null;
    openChatSheet({
      party: [makeCharacter('pc-1')],
      messages: [],
      myCharacterId: 'pc-1',
      onSend: (text) => { received = text; },
    });
    const input = document.querySelector('.cs-input') as HTMLInputElement;
    input.value = 'olá party';
    const send = document.querySelector('.cs-send') as HTMLButtonElement;
    send.click();
    expect(received).toBe('olá party');
    expect(input.value).toBe('');
  });

  it('appendChatMessage adiciona msg dinâmica', () => {
    openChatSheet({
      party: [makeCharacter('pc-1'), makeCharacter('pc-2')],
      messages: [],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    expect(document.querySelectorAll('.cs-msg').length).toBe(0);
    appendChatMessage({ id: 'm1', characterId: 'pc-2', speaker: 'pc-2', text: 'hey', timestamp: Date.now() });
    expect(document.querySelectorAll('.cs-msg').length).toBe(1);
    expect(document.querySelector('.cs-empty')).toBeNull();
  });

  it('closeChatSheet remove sheet', () => {
    openChatSheet({
      party: [makeCharacter('pc-1')],
      messages: [],
      myCharacterId: 'pc-1',
      onSend: () => {},
    });
    expect(isChatSheetOpen()).toBe(true);
    closeChatSheet();
    // pop é async (transição), mas isSheetOpen é sync via stack
    expect(isChatSheetOpen()).toBe(false);
  });
});

describe('Helpers chat-sheet', () => {
  it('avatarFor mago = 🧙', () => {
    const c = makeCharacter('pc-1', { classId: 'mago' });
    expect(_avatarForTest(c)).toBe('🧙');
  });

  it('avatarFor anao = 🪓', () => {
    const c = makeCharacter('pc-1', { raceId: 'anao-montanha' });
    expect(_avatarForTest(c)).toBe('🪓');
  });

  it('avatarFor tiefling = 😈', () => {
    const c = makeCharacter('pc-1', { raceId: 'tiefling' });
    expect(_avatarForTest(c)).toBe('😈');
  });

  it('avatarFor undefined = 👤', () => {
    expect(_avatarForTest(undefined)).toBe('👤');
  });

  it('relativeTime <60s = "agora"', () => {
    expect(_relativeTimeForTest(Date.now() - 5000)).toBe('agora');
  });

  it('relativeTime ~3min = "3m"', () => {
    expect(_relativeTimeForTest(Date.now() - 180_000)).toBe('3m');
  });
});
