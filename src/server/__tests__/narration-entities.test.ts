// Cenas com peso — tests pra extractor de NPCs/landmarks da narração.

import { describe, it, expect } from 'vitest';
import { extractNarrationEntities } from '../dm/narration-entities';

describe('extractNarrationEntities', () => {
  it('extrai nomes próprios capitalizados (NPCs)', () => {
    const narration = 'Borin entra. Lyra olha. Lorde Vexar grita.';
    const { npcs } = extractNarrationEntities(narration);
    expect(npcs).toContain('Borin');
    expect(npcs).toContain('Lyra');
    expect(npcs).toContain('Lorde');
  });

  it('ignora stop-words capitalizadas (Você/O/A/Mestre etc)', () => {
    const narration = 'Você entra. O homem grita. A mulher foge.';
    const { npcs } = extractNarrationEntities(narration);
    expect(npcs).not.toContain('Você');
    expect(npcs).not.toContain('O');
    expect(npcs).not.toContain('A');
  });

  it('extrai NPCs por PAPEL (lowercase: guarda/taverneiro/etc)', () => {
    const narration = 'O guarda saca a espada. O taverneiro afasta os copos. Um mendigo observa.';
    const { npcs } = extractNarrationEntities(narration);
    expect(npcs).toContain('guarda');
    expect(npcs).toContain('taverneiro');
    expect(npcs).toContain('mendigo');
  });

  it('extrai landmarks de cena', () => {
    const narration = 'A porta range. No baú dourado, um pergaminho. O altar atrás da parede.';
    const { landmarks } = extractNarrationEntities(narration);
    expect(landmarks).toContain('porta');
    expect(landmarks).toContain('bau'); // normalized
    expect(landmarks).toContain('pergaminho');
  });

  it('cap em 3 NPCs e 3 landmarks (UI não explode)', () => {
    const narration = 'Borin Lyra Sina Castelar Vexar Marfim viram porta baú janela altar mesa cadeira.';
    const { npcs, landmarks } = extractNarrationEntities(narration);
    expect(npcs.length).toBeLessThanOrEqual(3);
    expect(landmarks.length).toBeLessThanOrEqual(3);
  });

  it('ignora pontuação adjacente (porta, baú. altar!)', () => {
    const narration = 'porta, baú. altar!';
    const { landmarks } = extractNarrationEntities(narration);
    expect(landmarks).toContain('porta');
    expect(landmarks).toContain('bau');
    expect(landmarks).toContain('altar');
  });

  it('lida com acentos (cadáver → cadaver normalized)', () => {
    const narration = 'Um cadáver no chão. A estátua de pedra. O sarcófago aberto.';
    const { landmarks } = extractNarrationEntities(narration);
    expect(landmarks).toContain('cadaver');
    expect(landmarks).toContain('estatua');
    expect(landmarks).toContain('sarcofago');
  });

  it('narração vazia retorna listas vazias', () => {
    const { npcs, landmarks } = extractNarrationEntities('');
    expect(npcs).toEqual([]);
    expect(landmarks).toEqual([]);
  });

  it('mistura nomes próprios + papéis (até 3 total)', () => {
    const narration = 'Borin entra. O guarda da porta acena. O taverneiro grita.';
    const { npcs } = extractNarrationEntities(narration);
    expect(npcs.length).toBeLessThanOrEqual(3);
    expect(npcs).toContain('Borin'); // próprio primeiro
  });
});
