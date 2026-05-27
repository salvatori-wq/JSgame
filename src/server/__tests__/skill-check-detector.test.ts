// γ.2 — Tests do detector de skill check implícito.

import { describe, it, expect } from 'vitest';
import { detectImpliedSkillCheck } from '../skill-check-detector.js';

describe('detectImpliedSkillCheck', () => {
  describe('keywords positivas', () => {
    it('investigar / examinar → investigacao DC 12', () => {
      expect(detectImpliedSkillCheck('explore', 'Investigar a parede atrás do trono'))
        .toMatchObject({ skill: 'investigacao', dc: 12 });
      expect(detectImpliedSkillCheck('explore', 'Examinar o corpo'))
        .toMatchObject({ skill: 'investigacao' });
    });

    it('persuadir / convencer → persuasao DC 13', () => {
      expect(detectImpliedSkillCheck('talk', 'Persuadir o guarda a nos deixar passar'))
        .toMatchObject({ skill: 'persuasao', dc: 13 });
      expect(detectImpliedSkillCheck('talk', 'Convencer ela a vir conosco'))
        .toMatchObject({ skill: 'persuasao' });
    });

    it('intimidar / ameaçar → intimidacao DC 13', () => {
      expect(detectImpliedSkillCheck('talk', 'Intimidar com gesto da espada'))
        .toMatchObject({ skill: 'intimidacao', dc: 13 });
      expect(detectImpliedSkillCheck('talk', 'Ameaço ele com a adaga'))
        .toMatchObject({ skill: 'intimidacao' });
    });

    it('enganar / mentir → enganacao DC 14', () => {
      expect(detectImpliedSkillCheck('talk', 'Engana o mercador dizendo que sou nobre'))
        .toMatchObject({ skill: 'enganacao', dc: 14 });
      expect(detectImpliedSkillCheck('talk', 'Minto que sou amigo do rei'))
        .toMatchObject({ skill: 'enganacao' });
    });

    it('escutar / notar → percepcao DC 12', () => {
      expect(detectImpliedSkillCheck('explore', 'Escutar atentamente atrás da porta'))
        .toMatchObject({ skill: 'percepcao', dc: 12 });
      expect(detectImpliedSkillCheck('explore', 'Notar algo estranho no quarto'))
        .toMatchObject({ skill: 'percepcao' });
    });

    it('esconder / sneak → furtividade DC 13', () => {
      expect(detectImpliedSkillCheck('sneak', 'Esgueirar pela direita'))
        .toMatchObject({ skill: 'furtividade' });
      expect(detectImpliedSkillCheck('sneak', 'Mover sorrateiramente até a torre'))
        .toMatchObject({ skill: 'furtividade' });
    });

    it('escalar / nadar / saltar → atletismo DC 12', () => {
      expect(detectImpliedSkillCheck('explore', 'Escalar a parede'))
        .toMatchObject({ skill: 'atletismo', dc: 12 });
      expect(detectImpliedSkillCheck('explore', 'Nadar até o outro lado'))
        .toMatchObject({ skill: 'atletismo' });
    });

    it('curar / tratar → medicina DC 12', () => {
      expect(detectImpliedSkillCheck('explore', 'Curar o aliado caído'))
        .toMatchObject({ skill: 'medicina' });
      expect(detectImpliedSkillCheck('explore', 'Tratar a ferida do mago'))
        .toMatchObject({ skill: 'medicina' });
    });

    it('rastrear → sobrevivencia DC 13', () => {
      expect(detectImpliedSkillCheck('explore', 'Rastrear as pegadas do orc'))
        .toMatchObject({ skill: 'sobrevivencia' });
    });

    it('arrombar / destrancar → prestidigitacao DC 14', () => {
      expect(detectImpliedSkillCheck('explore', 'Arrombar a fechadura'))
        .toMatchObject({ skill: 'prestidigitacao' });
      expect(detectImpliedSkillCheck('explore', 'Destrancar o cofre'))
        .toMatchObject({ skill: 'prestidigitacao' });
    });

    it('lembrar / recordar → historia DC 14', () => {
      expect(detectImpliedSkillCheck('explore', 'Recordar lendas sobre essa runa'))
        .toMatchObject({ skill: 'historia' });
    });
  });

  describe('negação explícita', () => {
    it('não vou investigar → null', () => {
      expect(detectImpliedSkillCheck('explore', 'Não vou investigar essa porta')).toBeNull();
    });
    it('evito olhar → null', () => {
      expect(detectImpliedSkillCheck('explore', 'Evito olhar pra ele')).toBeNull();
    });
    it('esqueço o que sabia → null', () => {
      expect(detectImpliedSkillCheck('explore', 'Esqueço o que sabia da magia')).toBeNull();
    });
  });

  describe('skip conditions', () => {
    it('details vazio → null', () => {
      expect(detectImpliedSkillCheck('explore', undefined)).toBeNull();
      expect(detectImpliedSkillCheck('explore', '')).toBeNull();
      expect(detectImpliedSkillCheck('explore', '  ')).toBeNull();
    });

    it('details muito curto (<4 chars) → null', () => {
      expect(detectImpliedSkillCheck('explore', 'ok')).toBeNull();
    });

    it('action attack → null (combat flow)', () => {
      expect(detectImpliedSkillCheck('attack', 'Investigar o ponto fraco')).toBeNull();
    });

    it('action cast-spell → null', () => {
      expect(detectImpliedSkillCheck('cast-spell', 'Investigar a magia')).toBeNull();
    });

    it('action rest-short / rest-long → null', () => {
      expect(detectImpliedSkillCheck('rest-short', 'Investigar enquanto descanso')).toBeNull();
      expect(detectImpliedSkillCheck('rest-long', 'Procuro pistas dormindo')).toBeNull();
    });
  });

  describe('priority — primeira keyword vence', () => {
    it('investigar (mais alto) + escutar → investigacao', () => {
      // "investigar" e "escutar" ambos no texto — investigacao tem prioridade
      const r = detectImpliedSkillCheck('explore', 'Investigar e escutar ao mesmo tempo');
      expect(r?.skill).toBe('investigacao');
    });
  });

  describe('shape do retorno', () => {
    it('retorna {skill, dc, reason} com reason humano', () => {
      const r = detectImpliedSkillCheck('explore', 'Persuadir o NPC');
      expect(r).not.toBeNull();
      expect(typeof r!.skill).toBe('string');
      expect(typeof r!.dc).toBe('number');
      expect(typeof r!.reason).toBe('string');
      expect(r!.reason.length).toBeGreaterThan(3);
    });
  });
});
