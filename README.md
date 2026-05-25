# JSgame

> D&D 5e online coop com Mestre IA. Mobile + desktop. DOM puro. Sessões de 30 min.

## O que é

Um jogo de RPG D&D 5e simplificado, jogado online com até 3 amigos + Mestre IA. Cria um personagem real (raça + classe + atributos + antecedente), o Mestre narra um mundo aberto, vocês exploram → interagem → lutam → descansam. **Sem waves. Sem deck-builder. Sem energia.** Dados de verdade, ficha de verdade, Mestre de verdade.

## Pilares de design

1. **D&D 5e como espinha dorsal** — regras do Livro do Jogador embarcadas (atributos, perícias, ações, magias, condições)
2. **Mestre IA dita o mundo** — narra cenas, controla NPCs, aplica regras, lembra da campanha
3. **3 pilares do jogo**: Exploração / Interação Social / Combate
4. **Mobile-first** — UI portrait-narrow desde o boot, touch-friendly
5. **Online coop** — Socket.io, até 3 players, persistência cross-session
6. **Sessão curta** — 30-60 min por sessão, campanha cabe em 3-5 sessões

## Stack

- **Frontend**: Vite + TypeScript + DOM puro (sem Phaser, sem React)
- **Backend**: Node + Express + Socket.io
- **Persistência**: SQLite (better-sqlite3, síncrono, zero traps)
- **DM IA**: Groq Llama 3.3 70B (free tier) ou Anthropic Claude (pago)
- **Audio**: Web Audio API procedural (zero assets)

## Estrutura

```
src/
├── client/    — DOM, UI, socket-client
├── server/    — Express, Socket.io, persistence
├── shared/    — Types compartilhados
└── dnd/       — Regras D&D 5e (dice, attributes, races, classes, conditions, skills, spells, items)
```

## Como rodar (dev)

```bash
npm install
npm run dev        # sobe backend (3001) + frontend (5173) em paralelo
```

Abre http://localhost:5173.

Pra ter o DM IA real, copia `.env.example` pra `.env` e bota uma `GROQ_API_KEY` (free em https://console.groq.com).

## Aprendizados aplicados (do Cave Run)

- Path Windows sem `&` → npm/git funcionam direto, sem PowerShell workarounds
- `better-sqlite3` em vez de `sql.js` → zero Vite optimizeDeps trap
- DOM puro em vez de Phaser → mais simples, mais rápido, mais mobile-friendly
- Mestre IA persona Sombrio + Sarcástico + Trickster preservada (mas agora aplica regras D&D reais via tools)
- Mobile portrait-narrow framework desde o dia 1 (vars `--m-vh`, `--m-safe-*`)
- Vitest desde o boot — testes core nascem junto com a feature
- Feature flags em `src/shared/` pra rollback granular sem rebuild

## Status

🚧 **Foundation (F1)** em construção. Veja `git log` pra histórico.
