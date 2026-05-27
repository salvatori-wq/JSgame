// β.1 — Tests NPC roster persistente.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence } from '../persistence.js';
import { upsertNpc, listNpcs, topRecentNpcs, npcId, setNpcNotes, adjustRelationship, deleteNpcs, npcPromptLine } from '../npc-roster.js';

beforeAll(async () => {
  await initPersistence();
});

beforeEach(async () => {
  // Limpa para teste isolado
  await deleteNpcs('camp-test-npc');
  await deleteNpcs('camp-other');
});

describe('β.1 — npcId (pure)', () => {
  it('gera ID determinístico de nome + local', () => {
    expect(npcId('Senhor Brogundo', 'Taverna do Cervo')).toBe('senhor-brogundo--taverna-do-cervo');
  });

  it('lida com acentos via NFD strip', () => {
    expect(npcId('Anã Ferreira', 'Vila Mortis')).toBe('ana-ferreira--vila-mortis');
  });

  it('mesmo nome em locais diferentes = IDs diferentes', () => {
    const id1 = npcId('Borak', 'Caverna');
    const id2 = npcId('Borak', 'Cidade');
    expect(id1).not.toBe(id2);
  });

  it('local vazio gera ID só com nome', () => {
    expect(npcId('Sombra', '')).toBe('sombra');
  });
});

describe('β.1 — upsertNpc + listNpcs', () => {
  it('insere NPC novo', async () => {
    await upsertNpc({
      campaignId: 'camp-test-npc',
      name: 'Brogundo',
      archetype: 'Taverneiro',
      attitude: 'amigavel',
      currentLocation: 'Taverna do Cervo',
    });
    const list = await listNpcs('camp-test-npc');
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('Brogundo');
    expect(list[0]!.interactionCount).toBe(1);
    expect(list[0]!.relationship).toBe(0);
  });

  it('UPSERT mesmo NPC: bump interactionCount + atualiza lastSeen', async () => {
    const input = {
      campaignId: 'camp-test-npc', name: 'Brogundo', archetype: 'Taverneiro',
      attitude: 'amigavel' as const, currentLocation: 'Taverna do Cervo',
    };
    await upsertNpc(input);
    await upsertNpc(input);
    await upsertNpc(input);
    const list = await listNpcs('camp-test-npc');
    expect(list).toHaveLength(1);
    expect(list[0]!.interactionCount).toBe(3);
  });

  it('UPSERT atualiza atitude (DM pode mudar)', async () => {
    await upsertNpc({
      campaignId: 'camp-test-npc', name: 'Brogundo', archetype: 'Taverneiro',
      attitude: 'amigavel', currentLocation: 'Taverna',
    });
    await upsertNpc({
      campaignId: 'camp-test-npc', name: 'Brogundo', archetype: 'Taverneiro',
      attitude: 'hostil', currentLocation: 'Taverna',
    });
    const list = await listNpcs('camp-test-npc');
    expect(list[0]!.attitude).toBe('hostil');
  });

  it('NPCs de campanhas diferentes ficam isolados', async () => {
    await upsertNpc({
      campaignId: 'camp-test-npc', name: 'A', archetype: 'X', attitude: 'neutro', currentLocation: 'L1',
    });
    await upsertNpc({
      campaignId: 'camp-other', name: 'B', archetype: 'Y', attitude: 'neutro', currentLocation: 'L2',
    });
    expect((await listNpcs('camp-test-npc'))).toHaveLength(1);
    expect((await listNpcs('camp-other'))).toHaveLength(1);
  });

  it('topRecentNpcs limita por count', async () => {
    for (let i = 0; i < 8; i++) {
      await upsertNpc({
        campaignId: 'camp-test-npc',
        name: `NPC${i}`, archetype: 'T', attitude: 'neutro',
        currentLocation: `L${i}`,
      });
      // garante lastSeen diferente
      await new Promise(r => setTimeout(r, 5));
    }
    const top3 = await topRecentNpcs('camp-test-npc', 3);
    expect(top3).toHaveLength(3);
  });
});

describe('β.1 — setNpcNotes + adjustRelationship', () => {
  it('setNpcNotes salva notes', async () => {
    await upsertNpc({
      campaignId: 'camp-test-npc', name: 'Brog', archetype: 'X',
      attitude: 'neutro', currentLocation: 'L',
    });
    const id = npcId('Brog', 'L');
    await setNpcNotes('camp-test-npc', id, 'Deve favor de 50 po');
    const list = await listNpcs('camp-test-npc');
    expect(list[0]!.notes).toBe('Deve favor de 50 po');
  });

  it('adjustRelationship soma com clamp [-10,10]', async () => {
    await upsertNpc({
      campaignId: 'camp-test-npc', name: 'Brog', archetype: 'X',
      attitude: 'neutro', currentLocation: 'L',
    });
    const id = npcId('Brog', 'L');
    await adjustRelationship('camp-test-npc', id, 5);
    let list = await listNpcs('camp-test-npc');
    expect(list[0]!.relationship).toBe(5);

    await adjustRelationship('camp-test-npc', id, 99); // overflow
    list = await listNpcs('camp-test-npc');
    expect(list[0]!.relationship).toBe(10);

    await adjustRelationship('camp-test-npc', id, -100); // underflow
    list = await listNpcs('camp-test-npc');
    expect(list[0]!.relationship).toBe(-10);
  });
});

describe('β.1 — npcPromptLine (pure)', () => {
  it('formata linha pra prompt', () => {
    const line = npcPromptLine({
      id: 'x', campaignId: 'c', name: 'Brogundo', archetype: 'Taverneiro',
      attitude: 'amigavel', firstMet: 0, lastSeen: 0,
      lastLocation: 'Taverna', interactionCount: 3, notes: 'deve favor', relationship: 5,
    });
    expect(line).toContain('Brogundo');
    expect(line).toContain('Taverneiro');
    expect(line).toContain('amigavel');
    expect(line).toContain('+5');
    expect(line).toContain('3×');
    expect(line).toContain('Taverna');
    expect(line).toContain('deve favor');
  });

  it('relacionamento negativo sem +', () => {
    const line = npcPromptLine({
      id: 'x', campaignId: 'c', name: 'Inimigo', archetype: 'X',
      attitude: 'hostil', firstMet: 0, lastSeen: 0,
      lastLocation: 'L', interactionCount: 1, notes: '', relationship: -7,
    });
    expect(line).toContain('-7');
    expect(line).not.toContain('+');
  });
});
