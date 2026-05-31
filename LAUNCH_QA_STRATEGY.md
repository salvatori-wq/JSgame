# JSgame · Estratégia de QA de Lançamento (Launch Readiness)

> Documento mestre. A próxima sessão (e as seguintes) executa ISTO de forma
> autônoma, em ciclos. Objetivo: deixar o jogo pronto pra mercado — funcional,
> coerente, estável por horas, sem jargão, sem erro técnico na cara do jogador,
> sem imagem sobreposta, coop funcionando.
>
> Filosofia comprovada no projeto: **playtest empírico > audit estática** (a
> estática "mente": maioria falso-positivo). **Reproduzir antes de corrigir.**
> **Commit por fix, suíte verde, atrás de gate, desktop não regride.**

---

## 0. Definição de "pronto pra lançar" (o portão)

O jogo está pronto quando TODOS os temas A–J abaixo estão verdes E:

1. Uma **sessão real de 45–60 min** (cold-open → explorar → falar → lutar →
   lootar → descansar → subir de nível → repetir) roda com **0 bugs P0/P1**.
2. O **Mestre se mantém coerente** ao longo dela (sem contradição, sem dead-end,
   sem vazar stat/jargão, PT-BR família) — nota do juiz ≥ 8/10.
3. **Coop 2 jogadores** roda uma sessão inteira sem dessincronizar nem travar.
4. **Zero imagem/elemento sobreposto** em qualquer tela × viewport × estado.
5. **Suíte verde** + **typecheck limpo** + **smoke no aparelho** do João feito.

Cada tema tem critério de passagem explícito (§4). O portão é binário por tema.

---

## 1. A equipe (roster de agentes + papéis)

Papéis. Os "hunters" são subagentes **read-only** (Agent tool, `general-purpose`
ou `Explore`), rodados em paralelo no início de cada ciclo. Os papéis de
direção/correção são do **main loop** (você), porque o preview é stateful e a
correção precisa de controle + verificação.

| # | Papel | Tipo | Charter (o que entrega) |
|---|---|---|---|
| 1 | **Lead Playtester** | main loop | Dirige sessões reais no preview, reproduz candidatos, decide o que é bug. Dono do ciclo. |
| 2 | **Coop Tester** | main loop | Dirige 2 clientes socket simultâneos: lobby, join, turnos, chat, sync, reconnect, 1 jogador caído. |
| 3 | **DM Dramaturgo (Juiz)** | subagente | Lê o transcript de uma sessão LONGA e pontua: coerência, PT-BR, fog-of-war (sem vazar HP/CA/DC), persona Sombrio-Trickster, uso de memória/callbacks, repetição, dead-ends, texto-livre tratado bem. Adversarial: tenta achar o DM se contradizendo. |
| 4 | **Rules Lawyer** | subagente | Confere regra D&D 5e PHB: math de combate, action economy, condições, saves, slots, death saves, descanso, leveling. Cita PHB. |
| 5 | **Inspetor Visual** | main loop + subagente | Varre cada tela × viewport × estado por SOBREPOSIÇÃO (z-index), overflow, texto cortado, imagem quebrada, hit-target. (Requisito "sem imagens sobrepostas".) Empírico no preview + audit de z-index no CSS. |
| 6 | **Caça-Jargão** | subagente | Enum cru, ID interno, jargão dev, vazamento de tool-call, inglês em UI família. (Comprovado: Ciclo U + ciclo desta sessão.) |
| 7 | **Engenheiro de Resiliência** | subagente | Caminhos de erro (String(err) cru), loading eterno, cold-start, falha de provider, guards de null/vazio. (Comprovado: Ciclo V + ciclo desta sessão.) |
| 8 | **Testador de Resistência** | subagente + main loop | Sessão longa: bloat de estado, vazamento de memória, crescimento de contexto/token do DM, performance, reconnect/persistência por horas. |
| 9 | **Squad de Correção** | main loop | Implementa fix confirmado, atrás de gate, re-mede, adiciona guard de teste, typecheck + suíte, commit por fix. Worktree-isolado se paralelo. |

Não rode os 9 toda vez. Cada **ciclo escolhe um tema** e ativa os papéis
relevantes (ex.: tema Combate → Rules Lawyer + Lead Playtester + Inspetor Visual
do combat-screen).

---

## 2. O ciclo (a unidade de trabalho de cada sessão)

```
DISCOVER → REPRODUCE → FIX → VERIFY → COMMIT → DOCUMENT
```

1. **DISCOVER** (paralelo, read-only): spawn dos hunters do tema. Cada um devolve
   CANDIDATOS com `arquivo:linha` + repro concreta + confiança (ALTA/MÉDIA/BAIXA).
   Enquanto rodam, o Lead Playtester começa a dirigir o preview no mesmo tema.
2. **REPRODUCE** (main loop, empírico): confirma cada candidato ALTA/MÉDIA no
   preview/teste. **Descarta falso-positivo** (a estática mente — exija repro).
3. **FIX** (main loop): implementa só o confirmado. Atrás do gate certo
   (`is-portrait-narrow`/`is-landscape-phone`/`@media`/server-side). Desktop e
   demais modos não regridem.
4. **VERIFY**: re-mede no preview (getBoundingClientRect/getComputedStyle) E
   adiciona guard de teste. `npx tsc --noEmit` + `npx vitest run` verdes.
5. **COMMIT** por fix/tema. Mensagem em PT-BR via Bash here-doc (PowerShell quebra
   aspas). **Não deploya** (Render auto-deploy OFF → Manual Deploy do João).
6. **DOCUMENT**: atualiza o checklist vivo (§4) e a entrada do CLAUDE.md.

Um ciclo = um tema levado a verde (ou ao máximo possível headless, com o resíduo
de aparelho anotado pro João).

---

## 3. O harness empírico (como dirigir o preview headless)

Aprendizados que ECONOMIZAM HORAS (do Ciclo D desta sessão):

- **Servidores**: `preview_start` nomes `jsgame-backend` (3001) e
  `jsgame-frontend` (5173) do `.claude/launch.json`. Se sumirem, reinicia.
- **`preview_screenshot` TRAVA** neste ambiente. Medir com `preview_eval` +
  `getBoundingClientRect`/`getComputedStyle`. Snapshot a11y via `preview_snapshot`.
- **Navegação determinística**: `window.__nav({kind:'campaign', characterId})`
  (hook DEV-only em `main.ts`, gated `import.meta.env.DEV`). Rotas: home, login,
  wizard, sheet, campaign, lobby, profile.
- **Sessão sem clicar no card**: `POST /api/characters/prefab {prefabId:'borin'|
  'lyra'|'sina', ownerName:'Aventureiro'}` → `__nav` pra campaign. Cold-open é
  pré-escrito (instantâneo, sem LLM).
- **Mobile correto**: o preview é **non-coarse**. `preview_resize` NÃO dispara
  `resize` → `window.dispatchEvent(new Event('resize'))` pra rodar
  `applyEnvironmentClasses`. Pra testar o DEITADO, FORCE
  `document.body.classList.add('is-portrait-narrow','is-landscape-phone')` (o
  predicado coarse não liga sozinho headless). **Recarregue a página depois de
  mexer em classes** pra a tela renderizar no modo certo (a UI decide layout no
  render — classe stale = layout errado, NÃO é bug do app).
- **`env(safe-area-inset-*)` resolve 0** headless → notch é resíduo de aparelho.
- **Backend hiberna**: 1º acesso após idle pode dar 500 por segundos (tsx watch
  reiniciando) e volta a 200. Se o prefab falhar, repete.
- **LLM é lento/estocástico**: combate NEM sempre inicia ao clicar "Batalha" (o
  DM decide). Pra layout, prefira FORÇAR estado ou medir o que dá; pra fluxo real,
  aceite a latência (12s timeout) e use poucos passos por verificação.

Harness de medição reutilizável (injetar via eval no início): `overflow()` (acha
elementos passando do viewport), `hits(min)` (hit-targets < min), `m(sel,props)`
(rect + computed styles). Ver o transcript do Ciclo D pro código.

---

## 4. Checklist de lançamento (o portão, vivo)

Status: ✅ verde · ⚠️ parcial/risco · ❌ não testado/quebrado · 📱 só aparelho.
Atualize a cada ciclo. Cada linha diz o MÉTODO de teste.

### A. Onboarding & entrada
- [⚠️] Home carrega, prefab "JOGAR" funciona (sem SyntaxError — corrigido nesta
  sessão), wizard 8 passos, login/anônimo. *Método: playtest + Resiliência.*
- [ ] Wizard ponta a ponta cria PJ jogável (point-buy, race/class/subclass, feat).

### B. Loop de exploração
- [⚠️] Cold-open renderiza limpo; ação de TEXTO LIVRE → DM responde; chips de
  ação; skill-check (dado gira no toque); echoes em PT-BR. *Playtest validou
  happy-path nesta sessão. Falta: texto livre variado + casos de borda.*
- [ ] "Mandar texto livre" é fácil e funcional (campo, envio, DM entende o intent).

### C. Loop de combate
- [❌] Batalha inicia; iniciativa; atacar/esquivar/etc; target picker; action
  economy; condições; IA inimiga; fim de combate; XP + level-up. *Método: Rules
  Lawyer + playtest. 105 unit tests verdes, mas o END-TO-END no preview falta.*
- [ ] Echo de combate PT-BR (corrigido nesta sessão) confirmado em jogo real.

### D. Itens & inventário
- [❌] give_item; modal de inventário; equipar; usar; raridade; sintonia; loja.
  *Método: playtest (forçar give_item via DM) + Inspetor Visual do modal.*

### E. Descanso & progressão
- [❌] Descanso curto (hit dice) / longo (slots); level-up; ASI/feat. *Método:
  playtest + Rules Lawyer.*

### F. Coop (2+ jogadores)
- [❌] Lobby criar/entrar; presença; turnos; chat broadcast; sync de estado;
  reconnect; 1 jogador caído. *Método: Coop Tester (2 sockets).*

### G. Qualidade & coerência do Mestre (o mais difícil)
- [❌] Narrativa boa; PT-BR; fog-of-war (nunca cita HP/CA/DC do oponente);
  persona Sombrio-Trickster; usa memória/callbacks; sem repetição; sem dead-end;
  trata texto livre estranho com graça; **coerente por HORAS**. *Método: sessão
  longa (45–60 min de turnos reais) → DM Dramaturgo lê o transcript e pontua.*

### H. Integridade visual (sem imagens sobrepostas)
- [⚠️] Responsivo 320→430 + deitado: ✅ (F1-F6 + Ciclo D + E1/E2). Falta: varrer
  SOBREPOSIÇÃO (z-index) e imagem quebrada em TODOS os modais/overlays/estados
  (combate, level-up, dado, transições, coop). *Método: Inspetor Visual.*

### I. Resiliência & estabilidade
- [✅] Humanização de erro em TODOS os catch voltados pro jogador (feito nesta
  sessão). Falta: watchdog do cold-open (`joinCampaign`); timeout do lobby.
- [ ] Falha de provider LLM → failover visível, sem travar. *Método: Resiliência.*

### J. Aparelho (mãos do João, ~5 min)
- [📱] Notch, física do dado em rAF, auto-zoom iOS, auto-rotação, coop em 2
  celulares reais. *Checklist em `FASE6_CACA_BUGS.md` §Ciclo D.*

---

## 5. Roteiros por tema (o que cada ciclo faz)

### Ciclo Combate (C)
1. DISCOVER: Rules Lawyer (audita `combat.ts`, `spells-engine.ts`, action
   economy, saves) + Caça-Jargão (echo/labels de combate) + Inspetor Visual
   (combat-screen z-index/overlap).
2. REPRODUCE: prefab → forçar combate (clicar "Batalha"; se o DM narrar em vez de
   lutar, repetir ou usar um cold-open que já entra em combate — ex.: a cela do
   Lyra costuma escalar). Dirigir 3–4 rounds: atacar (target sheet), esquivar,
   usar feature, terminar. Medir layout + ler echoes.
3. FIX confirmados. VERIFY. COMMIT. DOCUMENT (marca C verde/parcial).

### Ciclo Coop (F)
1. DISCOVER: Resiliência (sync/reconnect/race) + Caça-Jargão (lobby).
2. REPRODUCE: no preview, abrir 2 conexões socket.io-client (bundled) na mesma
   página OU 2 contextos; criar lobby (cliente A), pegar ID, entrar (cliente B);
   verificar ambos veem o estado; alternar turnos; chat A→B; derrubar 1 PJ;
   reconnect. Medir broadcast + ordem.
3. FIX. VERIFY (+ testes de campaign-chat/sync já existem). COMMIT. DOCUMENT.

### Ciclo Mestre/Narrativa (G) — o mais caro (gasta LLM)
1. Dirigir uma sessão LONGA: ~20–40 turnos reais (explorar, falar com NPC, texto
   livre variado, lutar, lootar, descansar). Capturar TODO o transcript
   (narrações + echoes) via eval do narration-log.
2. DISCOVER: DM Dramaturgo (Juiz) lê o transcript → nota + lista de incoerências/
   vazamentos/repetições/dead-ends. Rules Lawyer confere as mecânicas narradas.
3. FIX: ajustes de prompt (`prompts.ts`), linter de narração (`narration-linter.ts`),
   memória/clocks, fog-of-war. VERIFY (testes de prompt/linter). COMMIT. DOCUMENT.

### Ciclo Itens & Progressão (D+E)
1. DISCOVER: Rules Lawyer (leveling/rest/slots) + Inspetor Visual (inventory/shop/
   level-up modais).
2. REPRODUCE: forçar give_item (texto livre pedindo loot, ou DM tool), abrir
   inventário, equipar, descansar (curto/longo), subir de nível.
3. FIX. VERIFY. COMMIT. DOCUMENT.

### Ciclo Visual Global (H)
1. DISCOVER: Inspetor Visual varre z-index em todo CSS + lista pares de elementos
   `position:absolute/fixed` que podem colidir.
2. REPRODUCE: abrir cada modal/overlay/transição em 320/390/deitado + estados
   (combate, dado, level-up, death banner, coop) e medir sobreposição
   (elementFromPoint + bounding boxes que se cruzam).
3. FIX. VERIFY (guards CSS). COMMIT. DOCUMENT.

---

## 6. Guardrails (não-negociáveis, do aprendizado do projeto)

- **Reproduzir antes de corrigir.** Candidato de agente é hipótese até você ver
  no preview/teste. A estática gera ~70% falso-positivo aqui.
- **Atrás de gate.** Mobile: `is-portrait-narrow`/`is-landscape-phone`/`@media`.
  Prove que desktop (1280×800) não regride.
- **Suíte verde + typecheck** antes de cada commit. Confie no EXIT code do vitest,
  não em regex de resumo (`feedback_powershell_batch_trap`).
- **Commit por fix.** Mensagem PT-BR via Bash here-doc (não PowerShell com aspas).
- **Não deploya.** Render free com auto-deploy OFF → Manual Deploy é do João.
  Sempre dizer o hash de `origin/main` pra ele subir.
- **PT-BR família.** Sem jargão dev, sem inglês, sem enum cru, sem stack na tela
  (`feedback_interface_alma`). O filho de 12a do João joga.
- **Zero budget.** Só free tier. Não sugerir serviço pago (`feedback_zero_budget`).
- **Não misturar PowerShell frágil com Edits/commit no mesmo batch** (cancela
  irmãos). Use Bash tool pra git.

---

## 7. Protocolo de sessão autônoma (o que cada conversa faz)

1. Ler `CLAUDE.md` (Estado Atual) + este doc + o checklist (§4, que vive aqui e
   no CLAUDE.md).
2. Escolher o **próximo tema não-verde** (ordem sugerida: C combate → F coop → G
   Mestre → D/E itens/progressão → H visual → fechar resíduos I/J). Combate e Coop
   primeiro porque são os de maior risco funcional ainda não testados end-to-end.
3. Rodar o ciclo do §2 nesse tema (DISCOVER hunters em paralelo + playtest +
   FIX + VERIFY + COMMIT + DOCUMENT).
4. Atualizar o checklist + a entrada do CLAUDE.md. Push. Dizer o hash pro João.
5. Repetir até o tema ficar verde ou o orçamento da sessão acabar. Deixar handoff
   limpo (usar a skill `context-handoff`).
6. **Decisões executivas** — o João prefere ação a pergunta. Só pergunte se for
   genuinamente ambíguo e mudar o rumo.

---

## 8. Métricas / sinais de progresso

- **Cobertura do checklist**: nº de temas verdes / 10.
- **Bugs por ciclo**: confirmados vs falso-positivos (calibra os hunters).
- **Nota do DM Dramaturgo** por sessão longa (alvo ≥ 8/10, tendência de subida).
- **Suíte**: nº de tests (cresce com guards), sempre verde.
- **Sessão de resistência**: minutos de jogo contínuo sem P0/P1 (alvo: 60).

Quando os 10 temas estiverem verdes + a sessão de 60 min limpa + smoke do João →
**candidato a lançamento**.
