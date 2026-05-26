# JSgame

> D&D 5e online coop com Mestre IA. Mobile + desktop. DOM puro. Sessões de 30 min.

**Status**: F3 entregue (Mestre IA + Modo Exploração funcionando). F4 (combate) é a próxima fase.
Veja [`HANDOFF_2026-05-25_F3-done-F4-next.md`](./HANDOFF_2026-05-25_F3-done-F4-next.md) pra retomar.

## O que é

Um jogo de RPG D&D 5e simplificado, jogado online com até 3 amigos + Mestre IA. Cria um personagem real (raça + classe + atributos + antecedente), o Mestre narra um mundo aberto, vocês exploram → interagem → lutam → descansam. **Sem waves. Sem deck-builder. Sem energia.** Dados de verdade, ficha de verdade, Mestre de verdade.

## Fases entregues

- ✅ **F1** — Foundation (Vite + TS + Socket.io + SQLite + D&D core: dice, attributes, 13 raças, 12 classes, 18 perícias, 14 condições, 13 antecedentes)
- ✅ **F2** — Wizard de criação de personagem (5 steps: raça → classe → atributos point buy 27 → antecedente → revisão)
- ✅ **F3** — Mestre IA Groq Llama 3.3 70B + Modo Exploração (cena narrada + 6 botões de ação + input livre + skill check d20 animado)
- ⏳ **F4** — Combate D&D real (initiative, ataques, save throws, 14 condições, AI inimigos)
- ⏳ **F5** — Polish + Coop multi-player + Magias + Rest mechanics + PWA

## Pilares de design

1. **D&D 5e como espinha dorsal** — regras do Livro do Jogador embarcadas
2. **Mestre IA dita o mundo** — Sombrio + Sarcástico + Trickster (BR coloquial)
3. **3 pilares**: Exploração / Interação Social / Combate
4. **Mobile-first** — UI portrait-narrow desde o boot, touch-friendly
5. **Online coop** — Socket.io, até 3 players, persistência cross-session
6. **Sessão curta** — 30-60 min por sessão

## Stack

- **Frontend**: Vite + TypeScript + DOM puro (sem Phaser, sem React)
- **Backend**: Node + Express + Socket.io
- **Persistência**: sql.js (pure-JS, sem build native)
- **DM IA**: Groq Llama 3.3 70B (free) ou Anthropic Claude (pago)

## Estrutura

```
src/
├── client/    — DOM, UI, socket-client
│   ├── character-creation/   — wizard 5 steps
│   └── campaign/             — exploration screen + skill check overlay
├── server/    — Express, Socket.io, persistence
│   └── dm/                   — providers (Groq/Anthropic) + prompts + tools + DungeonMaster
├── shared/    — Types compartilhados
└── dnd/       — Regras D&D 5e (PHB embarcado)
```

## Como rodar (dev)

```bash
npm install
npm run dev        # backend (3001) + frontend (5173) em paralelo
```

Abre **http://localhost:5173** (desktop) ou **http://192.168.15.3:5173** (celular na mesma WiFi).

Pra Mestre IA real, edita `.env` e bota uma `GROQ_API_KEY` (free em https://console.groq.com).
Sem key, o FallbackDM offline responde com mensagens placeholder.

## Comandos úteis

```bash
npm run dev          # backend + frontend em paralelo
npm run dev:server   # só backend (tsx watch)
npm run dev:client   # só vite
npm run typecheck    # tsc --noEmit
npm test             # vitest (58 tests passando)
```

## Aprendizados aplicados (do Cave Run)

- Path Windows sem `&` → npm/git funcionam direto
- `sql.js` em vez de `better-sqlite3` → zero compile native
- DOM puro em vez de Phaser → mais simples, mais mobile-friendly
- DM persona Sombrio + Sarcástico + Trickster preservada
- Mobile portrait-narrow framework desde o dia 1
- Vitest desde o boot — testes core nascem junto com a feature
- Validação server-side TODA tool call do LLM (clamp + sanitize)
- Footer dentro do dynamic re-render (state stale é o inimigo)
- `Object.assign` em vez de spread quando há múltiplas referências

## Repo

Local em `C:\Users\JOÃO\JSgame\`. Não tem GitHub remote ainda.
Cave Run continua em `C:\Users\JOÃO\D&D online\` — deploy Render ativo na URL legada, intocado.

## Keep-alive em prod (Render free tier)

Render free derruba a instância depois de ~15min sem requests, o que causa cold start de ~30s na próxima visita. Pra evitar isso em deploys públicos, configure um cron externo gratuito apontando pra `/api/health`:

1. **cron-job.org** (grátis, sem cadastro de cartão):
   - URL: `https://SEU-APP.onrender.com/api/health`
   - Schedule: a cada **10 minutos** (Render dorme após 15min)
   - Method: GET
   - Notifications: opcional (alert se falhar 3x seguidas)

2. **UptimeRobot** (alternativa free):
   - HTTP(s) monitor, 5min interval
   - Mesma URL

`/api/health` responde em < 50ms e retorna `{ ok, uptime, dmProvider, activeCampaigns }` — bom pra debug rápido também.

**Trade-off:** mantém a instância acordada 24/7 mas não conta no quota do Render free (tem 750h/mês de instância ativa, plenty pra single service).
