// γ.2 + Mestre Experiente — Tests do detector de skill check implícito.
// Cobre 18 patterns (8 mentais + 4 físicas + 4 sociais) + negação + edge cases.

import { describe, it, expect } from 'vitest';
import { detectImpliedSkillCheck } from '../skill-check-detector.js';

describe('Mestre Experiente — patterns novos (18 perícias completas)', () => {
  it('identificar magia / runa → arcanismo DC 14', () => {
    expect(detectImpliedSkillCheck('explore', 'Identificar a runa no portal'))
      .toMatchObject({ skill: 'arcanismo' });
    expect(detectImpliedSkillCheck('explore', 'Sentir aura mágica do altar'))
      .toMatchObject({ skill: 'arcanismo' });
  });

  it('símbolo divino / morto-vivo → religiao DC 13', () => {
    expect(detectImpliedSkillCheck('explore', 'Reconhecer o símbolo na parede'))
      .toMatchObject({ skill: 'religiao' });
    expect(detectImpliedSkillCheck('explore', 'Identificar tipo de morto-vivo'))
      .toMatchObject({ skill: 'religiao' });
    expect(detectImpliedSkillCheck('talk', 'Orar pela proteção'))
      .toMatchObject({ skill: 'religiao' });
  });

  it('planta / animal / clima → natureza DC 13', () => {
    expect(detectImpliedSkillCheck('explore', 'Identificar a planta venenosa'))
      .toMatchObject({ skill: 'natureza' });
    expect(detectImpliedSkillCheck('explore', 'Prever clima da noite'))
      .toMatchObject({ skill: 'natureza' });
  });

  it('diagnóstico / cadáver → medicina DC 13', () => {
    expect(detectImpliedSkillCheck('explore', 'Examinar o cadáver pra entender a causa'))
      .toMatchObject({ skill: 'medicina' });
    expect(detectImpliedSkillCheck('talk', 'Diagnosticar a doença do mendigo'))
      .toMatchObject({ skill: 'medicina' });
    expect(detectImpliedSkillCheck('explore', 'Estabilizar o aliado caído'))
      .toMatchObject({ skill: 'medicina' });
  });

  it('rastrear / forragear → sobrevivencia DC 13', () => {
    expect(detectImpliedSkillCheck('explore', 'Rastrear o orc até a caverna'))
      .toMatchObject({ skill: 'sobrevivencia' });
    expect(detectImpliedSkillCheck('explore', 'Achar abrigo seguro'))
      .toMatchObject({ skill: 'sobrevivencia' });
  });

  it('cavalgar / acalmar besta → adestrar-animais DC 12', () => {
    expect(detectImpliedSkillCheck('explore', 'Acalmar o cavalo assustado'))
      .toMatchObject({ skill: 'adestrar-animais' });
    expect(detectImpliedSkillCheck('travel', 'Cavalgar até a fronteira'))
      .toBeNull(); // travel action é excluída
  });

  it('cantar / tocar / atuar → atuacao DC 13', () => {
    expect(detectImpliedSkillCheck('talk', 'Cantar uma música pra distrair'))
      .toMatchObject({ skill: 'atuacao' });
    expect(detectImpliedSkillCheck('talk', 'Tocar o alaúde na taverna'))
      .toMatchObject({ skill: 'atuacao' });
  });

  it('ler intenção / duvido → intuicao DC 13', () => {
    expect(detectImpliedSkillCheck('talk', 'Sinto que ele esconde algo'))
      .toMatchObject({ skill: 'intuicao' });
    expect(detectImpliedSkillCheck('talk', 'Verifico se ele mente'))
      .toMatchObject({ skill: 'intuicao' });
  });

  it('arrombar / picklock → prestidigitacao DC 14', () => {
    expect(detectImpliedSkillCheck('explore', 'Arrombar a fechadura do cofre'))
      .toMatchObject({ skill: 'prestidigitacao' });
    expect(detectImpliedSkillCheck('explore', 'Escapar de amarras'))
      .toMatchObject({ skill: 'prestidigitacao' });
  });

  it('negação universal: "não vou cantar" → null', () => {
    expect(detectImpliedSkillCheck('talk', 'Não vou cantar agora')).toBeNull();
    expect(detectImpliedSkillCheck('explore', 'Desisto de identificar a planta')).toBeNull();
  });
});

describe('detectImpliedSkillCheck', () => {
  describe('keywords positivas', () => {
    it('investigar / procurar → investigacao DC 12', () => {
      expect(detectImpliedSkillCheck('explore', 'Investigar a parede atrás do trono'))
        .toMatchObject({ skill: 'investigacao', dc: 12 });
      expect(detectImpliedSkillCheck('explore', 'Procurar pistas no chão'))
        .toMatchObject({ skill: 'investigacao' });
      // "Examinar o corpo" agora vai pra medicina (semanticamente correto:
      // examinar corpo = diagnóstico/causa de morte, não investigação genérica)
      expect(detectImpliedSkillCheck('explore', 'Examinar o corpo'))
        .toMatchObject({ skill: 'medicina' });
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

// Sub-sprint D3 — Patterns adicionais (verbos comuns que faltavam)
describe('D3 — Patterns expandidos (verbos sensoriais + físicos)', () => {
  it('"cheirar o ar" → percepção', () => {
    expect(detectImpliedSkillCheck('explore', 'Cheiro o ar com cuidado'))
      .toMatchObject({ skill: 'percepcao' });
  });

  it('"sentir presença" → percepção', () => {
    expect(detectImpliedSkillCheck('explore', 'Sinto uma presença estranha aqui'))
      .toMatchObject({ skill: 'percepcao' });
  });

  it('"me aproximo devagar" → percepção', () => {
    expect(detectImpliedSkillCheck('explore', 'Me aproximo devagar do altar'))
      .toMatchObject({ skill: 'percepcao' });
  });

  it('"empurrar a porta" → atletismo', () => {
    expect(detectImpliedSkillCheck('explore', 'Empurro a porta com força'))
      .toMatchObject({ skill: 'atletismo' });
  });

  it('"levantar o baú" → atletismo', () => {
    expect(detectImpliedSkillCheck('explore', 'Levanto o baú pesado'))
      .toMatchObject({ skill: 'atletismo' });
  });

  it('"abrir o baú com força" → atletismo (força bruta)', () => {
    expect(detectImpliedSkillCheck('explore', 'Abro o baú com força bruta'))
      .toMatchObject({ skill: 'atletismo' });
  });
});
