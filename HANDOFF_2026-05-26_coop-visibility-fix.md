# Handoff coop visibility fix — 2026-05-26

## Bug relatado pelo João
> "não estava vendo o que eu mandava nem o que meu amigo mandava, só chegava erro!"

## Causa raiz (4 partes)

1. **takeAction não tinha echo** — server só emitia narração do Mestre. Player que digitou ação não via sua mensagem no log; aliado nem sabia o que ele tinha pedido.
2. **combatAction não tinha echo de log** — só vinha combatEvent solto (dano flutuante) sem contexto de quem atacou.
3. **Chat livre não tinha UI** — handler `socket.on('chat')` existia no server mas nenhum lugar no client emitia o evento. Speaker fixo "Player" tornava indistinguível de quem foi.
4. **Erros de race condition vinham como "⚠ Erro" no histórico** — race no joinCampaign (activeCampaignId ainda null), spectator clicando em check de outro player, etc.

## Fixes aplicados (commit 9eaebda)

| # | Onde | O que mudou |
|---|---|---|
| 1 | `src/server/index.ts:730` | Echo de takeAction. Antes de chamar Mestre, emit `dmNarration` `speaker: "▶ <PJname>"` com a ação + details pra room. |
| 2 | `src/server/index.ts:850` | Echo de combatAction. Antes dos combatEvents, emit narração `speaker: "⚔ <PJname>"` com `result.log`. |
| 3a | `src/client/campaign/campaign-screen.ts` | Nova `renderChatBar()` — input + Enter envia chat. Aparece só quando `party.length > 1`. |
| 3b | `src/client/styles/campaign-core.css` | CSS `.camp-chat-bar / .camp-chat-input / .camp-chat-send`. |
| 3c | `src/server/index.ts` chat handler | Usa nome real (`camp.party.find(id===activePlayerId).characterName`), trim, limite 280 chars, speaker `"💬 <PJname>"`. |
| 4a | `src/server/index.ts:787, 824` | Removeu emit('error') quando spectator tenta rolar check/save de outro player — silent return (UI já mostra "X está rolando..."). |
| 4b | `src/client/campaign/campaign-screen.ts` onError | Regex benigna `/no active campaign|campaign not found|outro player|sem combate ativo/` NÃO empilha no log. |

## Como validar (você + amigo)

1. **`npm run dev`** (já roda 3001 backend + 5173 frontend).
2. Ambos abrem `http://192.168.15.3:5173` (mobile) ou localhost (mesma máquina = abre 2 abas).
3. Cada um digita um nome diferente em "Quem é você?".
4. **Player A** clica "🏛 Criar Lobby" → copia o código (canto superior).
5. **Player B** cola o código + "🔗 Joinar Lobby".
6. Cada um escolhe/cria PJ no lobby (botão "Criar PJ" abre wizard).
7. Host (A) clica "Começar Crônica".
8. Em campanha, ambos devem ver:
   - **Chat bar no rodapé** (input "💬 Falar pra party" + botão Enviar). Só aparece com 2+ PJs.
   - Quando A digita Enter no chat: aparece pra ambos como `💬 <PJname>: <msg>`.
   - Quando A clica ação (Explorar/Atacar): aparece pra ambos como `▶ <PJname>: <action>` ANTES da narração do Mestre.
   - Em combate: ataque/grapple/etc aparece como `⚔ <PJname>: <log>` antes do dano flutuante.

## O que NÃO foi tocado nesta rodada

- Bugs profundos de lobby (race conditions na criação de PJ, status sync) — não foram reportados.
- Buff engine pra Bardic Inspiration / Bless / Guidance (F25 deixou só placeholder).
- Counterspell/Dispel Magic.
- Refactor routes/sockets do F35 (só dm-tool-applier foi extraído).

## Testes

- `npm run typecheck` ✓
- `npm test -- --run` → 398/398 verdes (sem regressão).
- Smoke playtest via preview tool: server up sem erros, console limpo, network sem requests falhados.
- Validação E2E coop com 2 sockets reais — **pendente do João + amigo** (não consegui simular 2 conexões reais via tooling sem gastar muito contexto).

## Próximo handoff

Após o playtest real coop, se ainda houver bugs, capture o erro que aparece (console do navegador F12 + log do server `npm run dev`) e cole numa nova conversa pra próxima rodada de fix.
