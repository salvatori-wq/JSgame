# Handoff — Estratégia de QA de Lançamento montada (pronta pra rodar autônoma)

## 1. Estado atual

2026-05-31. Tudo limpo, sem pendência de código. A responsividade está fechada e
no ar; um ciclo profundo de correção (jargão + erros) foi entregue e pushado. A
**estratégia de QA de lançamento** está escrita em `LAUNCH_QA_STRATEGY.md` —
pronta pra próxima sessão executar em ciclos autônomos. Nada bloqueante. Falta o
João dar um Manual Deploy do commit mais recente pra os fixes de correção irem ao
ar (os de responsivo já estão).

## 2. O que foi feito nesta sessão

1. **Ciclo D — smoke mobile emulado** (`ef6bc42`, docs `6240376`): empurrei a
   emulação headless ao limite (forcei `is-landscape-phone`, simulei browser-bar/
   notch, dirigi prefab real → exploração → skill-check → combate). Confirmei os
   pilares F1-F6 + 4 fixes (echo de combate redundante na ribbon, ct-skip 11→44px,
   login safe-area + compactação, recap deitado 26→18vh). +5 guards.
2. **E1 + E2** (`ec78f20`, docs `b21e20a`): header de campanha vira 1 linha no
   deitado (110→61px → dock de combate ~133px); micro-labels 9-10px passam a
   escalar com font-scale (`calc(px * var(--ux-font-scale))`, zero shift no
   default). +2 guards. **João fez Manual Deploy** do responsivo.
3. **Ciclo profundo de correção** (3 commits + docs `6836d90`): 2 caça-candidatos
   read-only + playtest empírico. `1683623` fix(jargão): echo de COMBATE vazava
   `→ attack (alvo enemy-…id)` (gap do Ciclo U) → `combatActionLabel()` server +
   nome do inimigo; memória sem enums crus (amigavel/consumivel/misc) + sem tags
   de indexação; glossário `advantage`→`vantagem`. `1d597c4` + `518877d`
   fix(erros): `humanizeServerError` em TODOS os catch do jogador (era 1 lugar);
   play-now checa `res.ok` antes de `.json()` (matava SyntaxError de cold-start no
   botão #1); reforço do tradutor (+502, +SyntaxError "servidor acordando").
4. **Estratégia de QA de lançamento**: `LAUNCH_QA_STRATEGY.md` NOVO — roster de 9
   papéis, ciclo DISCOVER→REPRODUCE→FIX→VERIFY→COMMIT→DOCUMENT, checklist de 10
   temas (A–J) com critério de passagem, harness empírico documentado, roteiros
   por tema, guardrails, protocolo de sessão autônoma.

Suíte 2125 → **2142** verde ao longo da sessão (+17 tests), typecheck sempre
limpo.

## 3. Contexto técnico relevante

- **Playtest empírico > audit estática** é a lei do projeto. Os 2 agentes desta
  sessão foram alto-sinal (não o "audit mente") porque foram escopados a
  categorias com bug REAL comprovado (Ciclo U jargão / Ciclo V erros) E eu
  reproduzi/li cada achado antes de corrigir. Replicar esse rigor.
- **Harness headless** (economiza horas, detalhado em `LAUNCH_QA_STRATEGY.md` §3):
  `preview_screenshot` trava → usar `preview_eval` + `getBoundingClientRect`.
  `window.__nav({kind,...})` (hook DEV-only em `main.ts`). Prefab via
  `POST /api/characters/prefab`. Deitado: forçar
  `is-portrait-narrow`+`is-landscape-phone` (non-coarse não liga sozinho) e
  RECARREGAR pra renderizar no modo certo. Combate é LLM-gated (nem sempre inicia
  ao clicar "Batalha").
- **Achado-raiz dos erros**: `humanizeServerError` (`src/client/humanize-error.ts`)
  existia mas só era chamado no `campaign-screen onError`. O fix foi aplicá-lo em
  todos os catch + checar `res.ok` antes de `res.json()` (cold-start do Render
  free devolve HTML, não JSON → SyntaxError).
- **Echo de combate**: `connection.ts` agora tem `combatActionLabel()` (espelha o
  `explorationActionLabel` do Ciclo U e o `combatActionLabel` do client). O server
  resolve o nome do inimigo via `camp.state.combat.enemies`.
- **Memórias do João** (em `C:\Users\JOÃO\.claude\projects\C--Users-JO-O-JSgame\
  memory\MEMORY.md`): `feedback_interface_alma` (UX é a alma, drama visual,
  pegada Uber), `feedback_zero_budget` (só free tier), `feedback_powershell_batch_trap`
  (não misturar PS frágil com commit; confiar no EXIT do vitest),
  `feedback_evidencia_deploy` (Render free pula auto-deploy — confirmar bundle em
  prod antes de diagnosticar). Ler antes de agir.

## 4. Fix/padrão central

Tradutor de erro nos caminhos quentes (replicável em qualquer fetch/catch novo):

```ts
// src/client/<qualquer>.ts — importar de humanize-error
import { humanizeServerError } from '../humanize-error';
// fetch: checar res.ok ANTES de .json() (cold-start devolve HTML)
const res = await fetch(url, {...});
if (!res.ok) { toastError(humanizeServerError(await res.text().catch(()=>'') || `Erro ${res.status}`)); return; }
const data = await res.json().catch(() => null);
// catch: nunca String(err) cru
catch (err) { toastError(humanizeServerError(String(err))); }
```

Label PT-BR pra echo (server-side, evita enum cru no log) —
`src/server/sockets/connection.ts`: `combatActionLabel(action)` +
`camp.state.combat.enemies.find(e=>e.id===targetId)?.name`.

## 5. Follow-ups sugeridos

Tudo abaixo é o trabalho da estratégia de lançamento. Ordem sugerida em
`LAUNCH_QA_STRATEGY.md` §7. Nenhum é bloqueante pra continuar — são o roadmap.

- [ ] **(não-bloqueante p/ João) Manual Deploy** do `origin/main` mais recente no
      Render pra subir os fixes de correção (jargão + erros). O responsivo já
      está no ar; estes ainda não.
- [ ] **Ciclo Combate (tema C)** — maior risco funcional não testado end-to-end.
- [ ] **Ciclo Coop (tema F)** — 2 clientes socket, sync, turnos, reconnect.
- [ ] **Ciclo Mestre/Narrativa (tema G)** — sessão longa + DM Dramaturgo (juiz).
- [ ] **Ciclo Itens & Progressão (D+E)** — give_item, inventário, descanso, level.
- [ ] **Ciclo Visual Global (H)** — varrer sobreposição/z-index em todos os modais.
- [ ] **Resíduos I/J** — watchdog do cold-open (`joinCampaign`); timeout do lobby;
      smoke no aparelho do João (notch, dado, coop em 2 celulares).

## 6. Arquivos-chave tocados

- `C:\Users\JOÃO\JSgame\LAUNCH_QA_STRATEGY.md` — NOVO: a estratégia mestre (equipe,
  ciclo, checklist, harness, roteiros, guardrails, protocolo autônomo).
- `C:\Users\JOÃO\JSgame\src\server\sockets\connection.ts` — `combatActionLabel()` +
  echo de combate PT-BR com nome do inimigo.
- `C:\Users\JOÃO\JSgame\src\server\dm-tool-applier.ts` — enums PT-BR no `indexFact`.
- `C:\Users\JOÃO\JSgame\src\client\campaign\memory-modal.ts` — esconde tags cruas.
- `C:\Users\JOÃO\JSgame\src\client\humanize-error.ts` — +502/SyntaxError, looksTechnical reforçado.
- `C:\Users\JOÃO\JSgame\src\client\home\sections\play-now.ts` — res.ok antes de json + humanize.
- `C:\Users\JOÃO\JSgame\src\client\{sheet,profile,...}` — humanize nos catch.
- `C:\Users\JOÃO\JSgame\src\client\styles\{campaign-core,modals,combat,status-ribbon,m-camp-dock}.css` — fixes Ciclo D + E1.
- `C:\Users\JOÃO\JSgame\src\client\main.ts` — hook DEV-only `window.__nav`.
- `C:\Users\JOÃO\JSgame\FASE6_CACA_BUGS.md` — §Ciclo D (resultados) + P2 fechados.
- `C:\Users\JOÃO\JSgame\CLAUDE.md` — Estado Atual (Ciclo D + E1/E2 + correção).

## 7. Deploy / ambiente

- **Prod = responsivo** (Ciclo D + E1/E2; bundle do `b21e20a`, deployado pelo
  João). **Os fixes de correção (jargão + erros, commits `1683623`→`6836d90`)
  estão pushados mas NÃO deployados** — Render free com auto-deploy OFF. João
  precisa de **Manual Deploy → "Deploy latest commit"** pra subirem.
- `origin/main` = `6836d90` (antes do commit desta estratégia; o commit da
  estratégia + handoff vem a seguir).
- URL `https://jsgame-drpe.onrender.com` · `/api/health` · serviço `jsgame`
  (`srv-d8abeurbc2fs73ft0fpg`). Cold-start hiberna.
- `npm run dev` (5173+3001) · `npm run typecheck` · `npx vitest run` (2142 verde —
  confiar no EXIT). Commit em PowerShell sem aspas — usar Bash/here-doc.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (rodar a estratégia em autônomo, sem decidir nada):**
> Lê o `CLAUDE.md`, o `LAUNCH_QA_STRATEGY.md` e o `HANDOFF_2026-05-31_launch-qa-strategy.md` do JSgame. Quero rodar a estratégia de QA de lançamento de forma AUTÔNOMA, em sessão longa: escolhe o próximo tema não-verde do checklist (§4), monta a equipe de agentes do roster (§1) pro tema, roda o ciclo DISCOVER→REPRODUCE→FIX→VERIFY→COMMIT→DOCUMENT (§2), reproduz tudo antes de corrigir, commit por fix, suíte verde, e atualiza o checklist. Não me pergunta a cada passo — decisões executivas. Começa pelo Combate (C) e segue pro Coop (F). No fim, me diz o hash pra eu dar o Manual Deploy.

**Opções específicas (se quiser mirar um tema):**

1. **Combate end-to-end (tema C):**
   > Roda o Ciclo Combate do `LAUNCH_QA_STRATEGY.md`: Rules Lawyer + Caça-Jargão + Inspetor Visual em paralelo no combat-screen, e dirige um combate real no preview (prefab → forçar batalha → 3-4 rounds → fim). Reproduz cada achado antes de corrigir, commit por fix, suíte verde. Atualiza o checklist tema C.

2. **Coop 2 jogadores (tema F):**
   > Roda o Ciclo Coop do `LAUNCH_QA_STRATEGY.md`: no preview, abre 2 conexões socket.io-client, cria lobby num cliente, entra no outro, testa turnos/chat/sync/reconnect/1-PJ-caído. Reproduz os bugs, corrige, commit por fix, suíte verde. Atualiza o checklist tema F.

3. **Coerência do Mestre por horas (tema G):**
   > Roda o Ciclo Mestre do `LAUNCH_QA_STRATEGY.md`: dirige uma sessão LONGA (20-40 turnos reais: explorar, falar, texto livre variado, lutar, lootar, descansar), captura o transcript, e spawna o DM Dramaturgo (juiz) pra pontuar coerência/PT-BR/fog-of-war/repetição/dead-ends. Corrige os gaps (prompt/linter/memória), commit por fix. Atualiza o checklist tema G.

4. **Varredura visual global (tema H):**
   > Roda o Ciclo Visual do `LAUNCH_QA_STRATEGY.md`: Inspetor Visual varre z-index/sobreposição em todo modal/overlay/estado (combate, dado, level-up, death, coop) a 320/390/deitado. Reproduz cada sobreposição no preview, corrige atrás de gate, guard CSS, commit por fix. Atualiza o checklist tema H.

Começa com a Opção curta se não tiver certeza — eu leio a estratégia e toco os
ciclos sozinho, do mais arriscado (Combate, Coop) pro menos. Se já souber o que
quer, vai direto numa das 4.
