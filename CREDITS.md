# Créditos de terceiros — JSgame

## Ícones (arte de fantasia)

Os ícones de criaturas, classes, condições, escolas de magia e itens vêm do
**[game-icons.net](https://game-icons.net/)**.

- **Licença:** [Creative Commons BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Autores:** Lorc, Delapouite e demais contribuidores do game-icons.net
- **Entrega:** baixados uma única vez via [Iconify API](https://iconify.design/)
  (set `game-icons`) e embarcados em `src/client/icons/game-icons-data.ts`.
  Nenhuma chamada externa em runtime — os SVGs são servidos pelo próprio bundle.
- **Regenerar / auditar a lista:** `npm run gen:icons`
  (ver `scripts/gen-game-icons.mjs` para a lista curada de ícones usados).

Conforme a licença CC BY 3.0, os autores acima são creditados. Os ícones podem
ter sido recoloridos via `currentColor`/CSS, mas não foram alterados em forma.

## Fontes

- **Cinzel** e **Cardo** — Google Fonts (Open Font License).

## Áudio

- Trilha e efeitos sonoros são **sintetizados proceduralmente** via Web Audio API
  (sem assets de terceiros).
