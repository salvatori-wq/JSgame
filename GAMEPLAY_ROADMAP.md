# JSgame · Roadmap de melhorias e correções

> Análise profunda 2026-05-26. Foco: quick wins, bug fixes, gameplay sólido,
> ZERO regressão (TDD reverso obrigatório).

---

## 0. Princípios não-negociáveis

1. **Cada fix tem test que falha ANTES e passa DEPOIS** — protege contra regressão futura.
2. **Suite verde a cada commit** (552/552 hoje). Tests amarelos ou pulados são bug.
3. **Commits atômicos**: 1 fix = 1 commit. Revert fácil se quebrar prod.
4. **Deploy + validação manual entre batches** — pega regressão antes de bater no jogador.
5. **Não introduz feature nova quando está fixando bug** (escopo cirúrgico).
6. **Refactor só se houver razão concreta** — não tocar `connection.ts:682 LOC` "por estética".

---

## 1. Inventário de bugs conhecidos

### 1.1 Confirmados (documentados em PLAYTEST_BUGS.md)

| ID | Severidade | Área | Status |
|---|---|---|---|
| BUG-001 | P0 | DM narração vazia | ✅ FIXED (commit 67705ef + 4ebce2e cascade) |
| BUG-002 | P2 | Tutorial exploração não dispara em rejoin | 🔴 ABERTO |
| HYPOTHESIS-003 | P2 | Counterspell race (enemy_casts + apply_damage same batch) | 🔴 ABERTO — não-reproduzido em prod ainda |

### 1.2 Hipotéticos (do handoff, não validados)

| Área | Hipótese | Risco |
|---|---|---|
| A3 auto-recap | Latência 8-12s no início da sessão 2+ (LLM 2x sequencial) | UX — parece travado |
| A4 friends | `resolveInvitesForNewUser` pode falhar se user já existia (anon legacy) | Coop quebrado pra users legados |
| B7 tutorial coop | Dispara 2x quando 2 players entram simultâneo | Visual confuso |
| M1 enemy AS | Scores absurdos pra monstros legacy (ex: gargula INT 12) | Saves de spells errados |
| B6 toast | Stack acumula em coop com muitos erros simultâneos | UI poluída |
| T1 telemetria | Hooks só em session/narration — falta combat/lobby/spell | Cego pra outros eventos |

### 1.3 Bug latente identificado nesta análise

**BUG-004 (NOVO)**: `spell-slots.ts` só preenche tabela até **nv 5** do PJ. PJs nv 6+ (que existem porque leveling.ts vai até nv 20) recebem **0 slots de níveis altos** mesmo conforme classe. Comentário no código admite:
> "Tabela só até nv 5 (foco do MVP). Slots > nv 3 ficam zerados — caster ainda não tem magias daquele nível anyway"

Mas `spells.ts` tem magias nv 1-9 cadastradas. Inconsistência: PJ nv 11 mago **conhece** Fireball nv 3+ mas não consegue castar magias nv 4-5 porque não tem slot.

**Severidade**: P1 — quebra leveling de casters nv 6+ (a longo prazo).

**BUG-005 (NOVO)**: Pact magic do Bruxo tratado como caster normal. PHB diz: Bruxo regenera slots em **short rest**, não em long rest. Atual: ambos em long rest. Bruxo perde feature de classe.

**Severidade**: P2 — afeta só players que escolhem Bruxo.

---

## 2. Quick wins (alto impacto, baixo esforço)

Ordenados por ROI (impacto/esforço):

### 🥇 QW-1 — Tutorial dispara em first narration (fix BUG-002)
**Esforço**: 30 min. **Impacto**: novo player não perde onboarding em rejoin.

**Diagnóstico** (já feito): trigger atual em `campaign-screen.ts:152` checa `!this.currentState && hasFirstNarration`. Em rejoin, state arrives antes de narration → condição falsa permanente.

**Fix**: mover trigger pra DENTRO do `onNarration` handler, com lock localStorage:
```ts
const onNarration = (payload) => {
  this.narrations.push(...);
  // ... existing logic
  if (state?.sessionNumber === 1 && shouldShowExplorationTutorial() && !tutorialFiredThisSession) {
    tutorialFiredThisSession = true;  // local lock — evita double-fire em coop
    setTimeout(() => openExplorationTutorial(), 1200);
  }
}
```

**Test**: simula sequência state→narration vs narration→state → tutorial deve disparar em ambos. Cobre coop double-fire.

### 🥈 QW-2 — Markdown rendering nas narrações
**Esforço**: 1h. **Impacto**: narrações dramaticamente mais expressivas.

DM ja gera texto com **bold** e *itálico* (visível em respostas Cerebras). Cliente renderiza como literal `**texto**`. Fix: usar `marked` ou regex simples pra **bold** + *italic* + `code`. XSS-safe — escape HTML, depois aplica formatação seletiva.

**Test**: `<script>alert</script>` no narration deve ser escapado, mas `**negrito**` virar `<strong>`.

### 🥉 QW-3 — Filtrar crônicas na home (mostrar só do user logado)
**Esforço**: 1h. **Impacto**: home limpa — não mais "Crônica de SIR GARRO" da pessoa A no feed de pessoa B.

Hoje `listRecentCampaigns` retorna TODAS. Schema `campaigns` não tem `user_id`, mas tem `partyCharacterIds` no state JSON. Solução:
- Filter server-side: SQL OR via FTS, OU
- Carrega top 50, filtra em memória pelo `userId` do session

User anônimo continua vendo tudo (não logado, comportamento atual).

**Test**: 2 users, 2 campanhas, cada `/api/campaigns` retorna só a sua.

### 4️⃣ QW-4 — Auto-recap paralelo (fix A3 latência)
**Esforço**: 30 min. **Impacto**: sessão 2+ abre em 5s vs 12s.

`campaign.ts:200-225` faz `dm.generateRecap()` **AWAIT** + depois `dm.narrate()` **AWAIT**. São independentes. Trocar pra `Promise.all`:
```ts
const [recap, mainResp] = await Promise.all([
  this.dm.generateRecap(topFacts, this.state.dmPersonality),
  this.dm.narrate({ ... }),
]);
if (recap) mainResp.narration = recap + '\n\n' + mainResp.narration;
```

Risco: nenhum — operações independentes, Promise.all preserva ordem do resultado.

### 5️⃣ QW-5 — Telemetria expandida (T1 gaps)
**Esforço**: 1h. **Impacto**: debug retroativo de bugs reportados.

Hoje só `session_started` + `narration_success/error`. Adicionar:
- `combat_started` / `combat_won` / `combat_lost`
- `character_created` / `character_died`
- `spell_cast` / `action_taken`
- `friend_invite_sent` / `friend_accepted`
- `lobby_created` / `lobby_joined`

Cada um: 1 linha `trackMetricEvent({...})` no handler relevante.

**Test**: estende `metrics.test.ts` cobrindo cada novo kind.

### 6️⃣ QW-6 — Visual "DM pensando" mais óbvio
**Esforço**: 30 min. **Impacto**: player não acha que travou em narrações de 25s+.

Atualmente `.camp-thinking` aparece pequeno. Aumentar:
- Spinner animado central
- Texto "Mestre escrevendo..." em destaque
- Timestamp "5s..." crescente (mostra que não travou)

CSS-only. Zero risco de regressão funcional.

---

## 3. Bugs P1/P2 a fixar em batch

### 3.1 BUG-004 — Spell slots nv 6-9 ausentes (P1)

**Plano**: Completar `SPELL_SLOTS_TABLE` em `spell-slots.ts` com nv 6-20 (PHB pág 113). Total: ~80 linhas de tabela copiadas direto do PHB. Mago/Clérigo/Druida/Bardo/Feiticeiro full casters; Paladino/Patrulheiro half; Bruxo pact magic separado.

**Test**: cobrir cada classe em nv 5, 11, 17, 20 — verificar slot counts batem com PHB.

### 3.2 BUG-005 — Pact Magic Bruxo regenera em short rest (P2)

**Plano**: `rest-handler.ts` recebe distinção entre short/long rest. Atual: short rest cura HD mas não toca spell slots. Mudança: se class Bruxo, short rest regenera slots Bruxo.

**Cuidado**: PJ multiclasse Mago/Bruxo tem slots separados (PHB pág 165). Short rest só regenera slots Bruxo, mantém Mago intactos.

**Test**: Bruxo nv 3 (2 slots nv 2) usa ambos → short rest → 2 slots restaurados.

### 3.3 HYPOTHESIS-003 — Counterspell race guard

**Plano**: Em `dm-tool-applier.ts apply_damage`, adicionar verificação:
- Se `pendingEnemySpell` existe MAS `createdAt` está no mesmo tool batch (`< 100ms` atrás), bloquear damage e empurrar pra próximo turno DM.
- Implementação: track `pendingEnemySpell.createdAt` (já existe) vs `Date.now() - batch_start_time`.

**Trade-off**: pode ser overkill — não-reproduzido em prod. Pode esperar reprodução real antes de fix.

**Decisão**: deixa pra Camada 3 (gameplay polish) — não bloqueia jogo.

### 3.4 A4 — `resolveInvitesForNewUser` testar com user legacy

**Plano**: Adicionar test cobrindo cenário "user já existe com email X, anon antes". Se test falha, fix necessário em `friends.ts:185`.

**Esforço**: 20 min só pra escrever test e ver se reproduz.

---

## 4. Gameplay gaps a fechar

### 4.1 Spell slots completos nv 6-20
Coberto em §3.1 — habilita campanhas de longo prazo. Sem isso, leveling acima de nv 5 fica degradado.

### 4.2 Resistências em saving throws de spells

Atualmente combat.ts respeita `resistances` em damage rolls. Mas spell saves usam `applyConditionTo` que não consulta resistências do alvo. Ex: Magic Missile não atinge ser etéreo, mas atualmente atinge.

**Plano**: refactor `applyConditionTo` pra checar `target.conditionImmunities` (campo já no schema).

### 4.3 Combat log visível pro player

`combat.log` existe e populado server-side, mas o cliente não exibe. Adicionar painel "📜 Log de combate" abaixo do narration. Útil pra player conferir damage/rolls que perdeu.

### 4.4 Ações faltando em combate

Combat hoje permite: atacar, lançar magia, esquivar, ajudar, fugir. Faltam:
- **Empurrar/Derrubar** (shove — PHB pág 195)
- **Agarrar** (grapple)
- **Esconder** (hide em combat, com check Furtividade)
- **Improvisar arma** (criatividade — DM decide DC)

Cada uma: ~30 min. Faz quando alguém pedir.

---

## 5. Code health (não-urgente)

| Item | Quando fazer | Justificativa |
|---|---|---|
| Split `connection.ts` (682 LOC) | Quando adicionar 2+ novos socket handlers | Hoje navegável |
| Split `campaign.ts` (932 LOC) | Quando adicionar feature grande tipo "rest extended" | Já split parcial (item/rest) |
| Slim system prompt DM (3K→1.5K tokens) | Quando notar quota consumo alto | Cerebras 1M/dia comporta bem o atual |
| Tests pra `connection.ts`, `routes/api.ts`, `email.ts` | Próximo grande refactor | Hoje passam por integration tests |

---

## 6. Plano de execução proposto

### Sprint 1 — Quick wins (2-3h, 0 risco)
- QW-1 Tutorial trigger fix
- QW-2 Markdown rendering
- QW-3 Home filter crônicas
- QW-4 Auto-recap paralelo
- QW-6 DM thinking visual

→ Commit batch único `fix(ux): quick wins QW-1 a QW-6`. Deploy. Valida em prod.

### Sprint 2 — Spell slots completos (1-2h)
- BUG-004 fix com tabela PHB completa
- Tests cobrindo nv 5/11/17/20 cada classe

→ Commit `fix(dnd): spell slots nv 6-20 completos (BUG-004)`. Deploy.

### Sprint 3 — Telemetria + observabilidade (1-2h)
- QW-5 expandir hooks de telemetria
- Endpoint `/api/dm/health` (do plano DM_IA_BLINDAGEM)

→ Commit `feat(telemetry): hooks combat/spell/lobby + dm health endpoint`.

### Sprint 4 — Polish gameplay (2-3h)
- 4.2 Resistências em saving throws
- 4.3 Combat log visível
- BUG-005 Pact magic short rest

→ Commits separados por área.

### Sprint 5 — Escopo aberto (opcional)
- Ações combate extras (shove/grapple/hide)
- Test coverage retroativa
- Refactor splits

---

## 7. Métricas de sucesso

| Métrica | Hoje | Meta pós-Sprint 4 |
|---|---|---|
| Tests totais | 552 | 600+ |
| Tests passando | 552/552 (100%) | 100% mantido |
| Bugs P0 abertos | 0 | 0 |
| Bugs P1 abertos | 0 (BUG-004 novo) | 0 |
| Bugs P2 abertos | 2 | ≤1 |
| Latência narração mediana | ~3s (Cerebras) | ~2s |
| DM error rate | <5% | <2% |
| Cobertura achievement hooks | ~40% | 90% |

---

## 8. Riscos identificados (e como mitigar)

### Risco A — Refactor de tutorial trigger quebra fluxo solo
**Mitigação**: test cobre 3 sequências: state→narration, narration→state, narration sem state (raro).

### Risco B — Markdown rendering vira vetor XSS
**Mitigação**: escape HTML *primeiro*, depois aplica markdown via regex limitado (só **, *, \`). Não usa `innerHTML` em texto user-controlled.

### Risco C — Home filter quebra usuários anônimos
**Mitigação**: se `userId` null, comportamento atual (mostra tudo público). Test cobre os 2 casos.

### Risco D — Promise.all do auto-recap inverte ordem do prefix
**Mitigação**: usamos `[recap, mainResp]` destructuring — ordem fixa. Test verifica recap aparece ANTES do narration.

### Risco E — Spell slots nv 6-9 quebra PJ legacy nv 1-5
**Mitigação**: tabela é ADITIVA — só preenche slots de nv mais alto pra PJ de nv mais alto. PJ nv 1 continua com `{1: 2, 2:0, ..., 9:0}`.

### Risco F — Telemetria nova causa overhead
**Mitigação**: `trackMetricEvent` já é `void this.trackXxx()` (fire-and-forget). Catch swallow erros. Já testado em prod.

---

## 9. Checklist pré-commit (rotina)

Antes de cada commit do roadmap:
1. `npm test -- --run` → 552+ verde
2. `npm run typecheck` → 0 erros
3. Test novo do fix deve ter FALHADO antes do fix existir (rodar primeiro sem o fix)
4. Re-run test com fix → passa
5. Diff git: mudanças cirúrgicas, sem refactor lateral inesperado
6. Commit message: `(area): descrição curta — ref BUG-NNN`
7. Push → deploy auto Render
8. Curl `/api/health` pós-deploy
9. Smoke test 1 ação em prod (Chrome MCP)
10. Próximo item

---

## 10. Decisão pro João

**Recomendado**: começar pela **Sprint 1 (Quick wins)** — 5 fixes pequenos com test cada, ~2-3h total, zero risco, impacto imediato no que você vai sentir jogando hoje.

Se aceitar, eu executo seguindo o checklist da §9. Pode parar entre qualquer commit.

Sprint 2 (spell slots) é a próxima prioridade se você for jogar campanhas longas (PJ chegar nv 6+).

Sprint 3+ podem ser feitos em outras sessões.
