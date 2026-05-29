// JSgame · Gerador da base de ícones SVG (Fase 1A "Rumo ao 10/10").
//
// Puxa um conjunto CURADO de ícones do game-icons.net via API pública do
// Iconify (free, sem key) e gera `src/client/icons/game-icons-data.ts`.
//
// Provenance: game-icons.net — licença CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
// Autores: Lorc, Delapouite e contribuidores. Ver CREDITS.md.
//
// Rodar:  node scripts/gen-game-icons.mjs   (ou `npm run gen:icons`)
// Zero-budget: fetch one-time em dev. O bundle de produção embarca os paths —
// nenhuma chamada externa em runtime (PWA/offline-safe).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/client/icons/game-icons-data.ts');

// Lista curada. Mantida agrupada por uso pra facilitar manutenção.
// Cada nome existe no set game-icons do Iconify (verificado).
const NAMES = [
  // — Classes (12) —
  'battle-axe', 'lyre', 'evil-eyes', 'holy-symbol', 'oak', 'magic-swirl',
  'broadsword', 'hood', 'pointy-hat', 'fist', 'winged-sword', 'high-shot',
  // — Condições (PHB) —
  'dead-head', 'knocked-out-stars', 'stone-bust', 'terror', 'grab',
  'imprisoned', 'poison-bottle', 'hearts', 'falling', 'blindfold',
  'broken-bone', 'invisible', 'cancel',
  // — Escolas de magia (8) —
  'shield', 'all-seeing-eye', 'magic-portal', 'charm', 'fireball', 'psychic-waves',
  'transform',
  // — Tipos de item —
  'crossed-swords', 'breastplate', 'checked-shield', 'round-potion', 'gems',
  'gear-hammer', 'backpack',
  // — Inimigos / criaturas —
  'goblin-head', 'orc-head', 'skeleton', 'shambling-zombie', 'wolf-head',
  'bear-head', 'dragon-head', 'spider-face', 'troll', 'ogre', 'bandit',
  'cultist', 'spectre', 'ghost', 'horned-skull', 'imp',
  'slime', 'vampire-dracula', 'minotaur', 'harpy', 'snake', 'rat', 'boar',
  'lion', 'octopus', 'lizardman', 'werewolf', 'giant', 'hydra', 'wyvern',
  'fangs', 'devil-mask', 'direwolf',
];

async function main() {
  const unique = [...new Set(NAMES)].sort();
  const url = `https://api.iconify.design/game-icons.json?icons=${unique.join(',')}`;
  console.log(`[gen-game-icons] fetching ${unique.length} icons from Iconify…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Iconify API ${res.status}`);
  const data = await res.json();
  const setW = data.width ?? 512;
  const setH = data.height ?? 512;

  const rows = [];
  const missing = [];
  for (const name of unique) {
    const icon = data.icons?.[name];
    if (!icon) { missing.push(name); continue; }
    const w = icon.width ?? setW;
    const h = icon.height ?? setH;
    rows.push({ name, body: icon.body, w, h });
  }
  if (missing.length) {
    console.warn(`[gen-game-icons] ⚠ ${missing.length} faltando: ${missing.join(', ')}`);
  }

  const lines = rows.map((r) => {
    const body = JSON.stringify(r.body);
    return `  ${JSON.stringify(r.name)}: { w: ${r.w}, h: ${r.h}, b: ${body} },`;
  });

  const out = `// GERADO por scripts/gen-game-icons.mjs — NÃO EDITAR À MÃO.
// Fonte: game-icons.net via Iconify API. Licença CC BY 3.0 (ver CREDITS.md).
// Autores: Lorc, Delapouite e contribuidores.
// Regenerar: npm run gen:icons
//
// ${rows.length} ícones. Cada \`b\` é o conteúdo interno do <svg> (paths com
// fill="currentColor"); \`w\`/\`h\` definem o viewBox.

export interface GameIconRaw {
  /** viewBox width */
  w: number;
  /** viewBox height */
  h: number;
  /** inner SVG markup (paths) — usa fill="currentColor" */
  b: string;
}

export const GAME_ICON_DATA: Record<string, GameIconRaw> = {
${lines.join('\n')}
};
`;

  writeFileSync(OUT, out, 'utf8');
  console.log(`[gen-game-icons] ✓ escreveu ${rows.length} ícones em ${OUT}`);
}

main().catch((err) => {
  console.error('[gen-game-icons] FALHOU:', err);
  process.exit(1);
});
