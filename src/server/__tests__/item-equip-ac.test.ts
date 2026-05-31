// QA-lançamento — Ciclo D/E. Reproduz + guarda 2 bugs de CA no equip de itens
// (achados pelo Rules Lawyer, traçados em item-handler.ts):
//   BUG-A: cota de malha (armadura PESADA PHB p.145 = CA 16 fixa) vinha como
//          13+min(2,DEX) (fórmula de armadura MÉDIA) → subvalorizava 2-3 de CA.
//   BUG-B: equipar o CORPO recalculava a AC do zero e PERDIA o +2 do escudo já
//          equipado; e equipar 2 escudos empilhava +2 cada (PHB p.144 = 1 escudo).
// CA dirige todo ataque-vs-CA no combate, então isso corrompia o jogo.

import { describe, it, expect } from 'vitest';
import { handleEquipItem, handleUnequipItem } from '../campaign-handlers/item-handler';

function mkPlayer(des: number) {
  return {
    id: 'p1',
    characterName: 'Borin',
    armorClass: 10,
    equippedArmor: undefined as string | undefined,
    equippedShield: undefined as string | undefined,
    equippedWeapons: [] as string[],
    abilityScores: { for: 10, des, con: 10, int: 10, sab: 10, car: 10 },
    inventory: [
      { id: 'chain', name: 'Cota de Malha', type: 'armadura', quantity: 1 },
      { id: 'plate', name: 'Cota de Placas', type: 'armadura', quantity: 1 },
      { id: 'leather', name: 'Armadura de Couro', type: 'armadura', quantity: 1 },
      { id: 'shieldA', name: 'Escudo de Madeira', type: 'escudo', quantity: 1 },
      { id: 'shieldB', name: 'Escudo de Ferro', type: 'escudo', quantity: 1 },
    ],
  };
}
// O handler só toca camp.party.find(p=>p.id) e camp.pushRecentEvent(...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkCamp = (player: ReturnType<typeof mkPlayer>) => ({ party: [player], pushRecentEvent() {} }) as any;

describe('QA D/E — CA no equip (PHB)', () => {
  it('BUG-A: cota de malha = CA 16 fixa, sem DEX (armadura pesada)', async () => {
    const pDex = mkPlayer(18); // DEX +4 — não deve contar pra armadura pesada
    await handleEquipItem(mkCamp(pDex), 'p1', 'chain', 'armor');
    expect(pDex.armorClass).toBe(16); // antes: 13 + min(2,4) = 15

    const pLowDex = mkPlayer(10); // DEX +0
    await handleEquipItem(mkCamp(pLowDex), 'p1', 'chain', 'armor');
    expect(pLowDex.armorClass).toBe(16); // antes: 13 + 0 = 13
  });

  it('couro = 11 + DEX; cota de placas = 18 fixa (não regridem)', async () => {
    const p = mkPlayer(14); // DEX +2
    const camp = mkCamp(p);
    await handleEquipItem(camp, 'p1', 'leather', 'armor');
    expect(p.armorClass).toBe(13); // 11 + 2
    await handleEquipItem(camp, 'p1', 'plate', 'armor');
    expect(p.armorClass).toBe(18);
  });

  it('BUG-B: escudo NÃO empilha (+2 só uma vez, PHB p.144)', async () => {
    const p = mkPlayer(10);
    const camp = mkCamp(p);
    await handleEquipItem(camp, 'p1', 'chain', 'armor');   // 16
    await handleEquipItem(camp, 'p1', 'shieldA', 'shield'); // 18
    expect(p.armorClass).toBe(18);
    await handleEquipItem(camp, 'p1', 'shieldB', 'shield'); // mesmo slot — NÃO vira 20
    expect(p.armorClass).toBe(18);
    expect(p.equippedShield).toBe('shieldA'); // mantém o primeiro
  });

  it('BUG-B: equipar o CORPO preserva o +2 do escudo já equipado', async () => {
    const p = mkPlayer(10);
    const camp = mkCamp(p);
    await handleEquipItem(camp, 'p1', 'shieldA', 'shield'); // 10 -> 12
    expect(p.armorClass).toBe(12);
    await handleEquipItem(camp, 'p1', 'chain', 'armor');    // 16 + 2 (escudo preservado) = 18
    expect(p.armorClass).toBe(18);
  });

  it('unequip de escudo equipado remove exatamente +2', async () => {
    const p = mkPlayer(10);
    const camp = mkCamp(p);
    await handleEquipItem(camp, 'p1', 'plate', 'armor');    // 18
    await handleEquipItem(camp, 'p1', 'shieldA', 'shield'); // 20
    await handleUnequipItem(camp, 'p1', 'shield', 'shieldA'); // 18
    expect(p.armorClass).toBe(18);
    expect(p.equippedShield).toBeUndefined();
  });

  it('regressão: unequip de escudo inexistente NÃO subtrai CA (já guardado)', async () => {
    const p = mkPlayer(10);
    const camp = mkCamp(p);
    await handleEquipItem(camp, 'p1', 'plate', 'armor');     // 18, sem escudo
    await handleUnequipItem(camp, 'p1', 'shield', 'shieldA'); // não tinha escudo
    expect(p.armorClass).toBe(18);
  });
});
