// @vitest-environment happy-dom
// Fase 1A — Testes do motor de ícones SVG (game-icons.net).

import { describe, it, expect } from 'vitest';
import {
  hasGameIcon,
  gameIconMarkup,
  iconEl,
  enemyIconName,
  classIconName,
  conditionIconName,
  schoolIconName,
  itemTypeIconName,
  CLASS_ICON,
} from '../game-icons';
import { GAME_ICON_DATA } from '../game-icons-data';

describe('registry base', () => {
  it('tem ícones embarcados', () => {
    expect(Object.keys(GAME_ICON_DATA).length).toBeGreaterThanOrEqual(60);
  });

  it('hasGameIcon reconhece registrados e desconhecidos', () => {
    expect(hasGameIcon('orc-head')).toBe(true);
    expect(hasGameIcon('battle-axe')).toBe(true);
    expect(hasGameIcon('nao-existe-xyz')).toBe(false);
  });

  it('todo nome mapeado existe de fato no registry', () => {
    const allNames = [
      ...Object.values(CLASS_ICON),
    ];
    for (const n of allNames) expect(hasGameIcon(n)).toBe(true);
  });
});

describe('gameIconMarkup', () => {
  it('gera <svg> com viewBox e currentColor pra ícone válido', () => {
    const m = gameIconMarkup('orc-head');
    expect(m).toContain('<svg');
    expect(m).toContain('viewBox="0 0 512 512"');
    expect(m).toContain('class="gi"');
    expect(m).toContain('currentColor');
    expect(m).toContain('aria-hidden="true"');
  });

  it('retorna string vazia pra ícone inexistente', () => {
    expect(gameIconMarkup('nao-existe-xyz')).toBe('');
  });

  it('com title vira role=img + aria-label + <title>', () => {
    const m = gameIconMarkup('orc-head', { title: 'Orc' });
    expect(m).toContain('role="img"');
    expect(m).toContain('aria-label="Orc"');
    expect(m).toContain('<title>Orc</title>');
    expect(m).not.toContain('aria-hidden');
  });

  it('escapa caracteres perigosos no title', () => {
    const m = gameIconMarkup('orc-head', { title: '<x>&"' });
    expect(m).toContain('&lt;x&gt;&amp;&quot;');
    expect(m).not.toContain('<title><x>');
  });

  it('aplica className extra', () => {
    expect(gameIconMarkup('orc-head', { className: 'foo' })).toContain('class="gi foo"');
  });
});

describe('iconEl (DOM)', () => {
  it('produz span.gi-wrap com SVG dentro pra ícone válido', () => {
    const span = iconEl('orc-head', '👹', { className: 'cb-enemy-glyph' });
    expect(span.tagName).toBe('SPAN');
    expect(span.className).toContain('gi-wrap');
    expect(span.className).toContain('cb-enemy-glyph');
    expect(span.querySelector('svg')).not.toBeNull();
    expect(span.textContent).toBe('');
  });

  it('cai no emoji de reserva pra ícone inexistente', () => {
    const span = iconEl('nao-existe-xyz', '👹');
    expect(span.querySelector('svg')).toBeNull();
    expect(span.classList.contains('gi-wrap-emoji')).toBe(true);
    expect(span.textContent).toBe('👹');
  });
});

describe('enemyIconName — matcher PT-BR + EN', () => {
  const cases: Array<[string, string]> = [
    ['Goblin Batedor', 'goblin-head'],
    ['Orc Selvagem', 'orc-head'],
    ['Esqueleto Guerreiro', 'skeleton'],
    ['Zumbi Apodrecido', 'shambling-zombie'],
    ['Lobo Faminto', 'wolf-head'],
    ['Urso Pardo', 'bear-head'],
    ['Dragão Vermelho', 'dragon-head'],
    ['Aranha Gigante', 'spider-face'], // aranha vence gigante (é uma aranha)
    ['Rato Gigante', 'rat'],
    ['Bandido da Estrada', 'bandit'],
    ['Cultista Sombrio', 'cultist'],
    ['Espectro Vingativo', 'spectre'],
    ['Vampiro Ancião', 'vampire-dracula'],
    ['Kobold Ladrão', 'lizardman'],
    ['Troll das Cavernas', 'troll'],
    ['Ogro Bruto', 'ogre'],
    ['Minotauro', 'minotaur'],
    ['Serpente Venenosa', 'snake'],
    ['Cubo Gelatinoso', 'slime'],
    ['Guarda da Cidade', 'broadsword'],
    ['Imp Travesso', 'imp'],
  ];
  for (const [name, expected] of cases) {
    it(`"${name}" → ${expected}`, () => {
      expect(enemyIconName(name)).toBe(expected);
    });
  }

  it('é case-insensitive', () => {
    expect(enemyIconName('GOBLIN')).toBe('goblin-head');
    expect(enemyIconName('dRaGãO')).toBe('dragon-head');
  });

  it('sem match: comum → fangs, chefe → horned-skull', () => {
    expect(enemyIconName('Carcereiro Bruto')).toBe('fangs'); // inimigo real do playtest
    expect(enemyIconName('Coisa Indescritível', true)).toBe('horned-skull');
    expect(enemyIconName('', false)).toBe('fangs');
  });

  it('todo resultado do matcher existe no registry', () => {
    for (const [name] of cases) expect(hasGameIcon(enemyIconName(name))).toBe(true);
    expect(hasGameIcon(enemyIconName('xyz', true))).toBe(true);
    expect(hasGameIcon(enemyIconName('xyz', false))).toBe(true);
  });
});

describe('mapas semânticos por enum', () => {
  it('classe PT-BR → ícone registrado', () => {
    expect(classIconName('guerreiro')).toBe('broadsword');
    expect(classIconName('mago')).toBe('pointy-hat');
    expect(classIconName('BARBARO'.toLowerCase())).toBe('battle-axe');
    expect(hasGameIcon(classIconName('paladino'))).toBe(true);
    expect(classIconName('jedi')).toBe('');
    expect(classIconName(null)).toBe('');
  });

  it('condição → ícone (ou vazio quando não mapeada)', () => {
    expect(conditionIconName('envenenado')).toBe('poison-bottle');
    expect(conditionIconName('Cego')).toBe('blindfold');
    expect(conditionIconName('surdo')).toBe(''); // sem ícone bom → emoji fallback
  });

  it('escola de magia → ícone', () => {
    expect(schoolIconName('evocacao')).toBe('fireball');
    expect(schoolIconName('necromancia')).toBe('dead-head');
    expect(hasGameIcon(schoolIconName('ilusao'))).toBe(true);
  });

  it('tipo de item → ícone', () => {
    expect(itemTypeIconName('arma')).toBe('crossed-swords');
    expect(itemTypeIconName('consumivel')).toBe('round-potion');
    expect(hasGameIcon(itemTypeIconName('misc'))).toBe(true);
  });
});
