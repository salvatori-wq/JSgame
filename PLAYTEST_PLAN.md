# JSgame · Plano de playtest end-to-end + bug-fix eficiente

> Próxima sessão deve seguir esse plano. Objetivo: validar 12+ features novas em prod, capturar bugs estruturados, e fixar em batches priorizados.

---

## 1. Setup pré-playtest (15 min)

### 1.1 Validar ambiente
```bash
# Local
git pull
npm test -- --run               # baseline: deve dar 533/533 verde
npm run typecheck                # deve dar 0 erros

# Prod
curl -s https://jsgame-drpe.onrender.com/api/health | python -m json.tool
# Esperado: hasGemini=true, activeProvider=DungeonMaster, uptime crescente
```

### 1.2 Ferramentas em paralelo
- **Aba 1 (Chrome MCP)** — `https://jsgame-drpe.onrender.com` (prod) ou `http://localhost:5173` (local). Eu controlo via `mcp__Claude_in_Chrome__*`.
- **Aba 2 (DevTools)** — `mcp__Claude_in_Chrome__read_console_messages` pra capturar logs/erros do frontend.
- **Backend logs** — Render dashboard → Logs (se prod) OU terminal `npm run dev:server` (se local).
- **Network tab** — `mcp__Claude_in_Chrome__read_network_requests` pra ver socket events + REST.
- **Bug log** — arquivo `PLAYTEST_BUGS.md` (criar limpo no início, append durante).

### 1.3 Cleanup state inicial
- Limpar localStorage Chrome: `localStorage.clear()` → garante tutorial dispara, sem PJ residual.
- Criar conta de teste fresca via magic link (email descartável OK).

---

## 2. Test matrix — cenários executáveis

Cada cenário tem: **Objetivo**, **Passos**, **Critério de sucesso**, **O que validar no log**.

### F1 — Onboarding novo player (smoke)
**Objetivo**: confirmar que primeira experiência funciona end-to-end.
**Passos**:
1. Home anon → "criar PJ" → wizard 5 steps (Tiefling mago, point buy default, background sage)
2. Confirmar criação → vai pra sheet
3. Solo: clica "Começar Crônica" → entra na campanha
**Critério**: tutorial de exploração (B7) aparece após primeira narração.
**Validar**:
- Console: sem erros vermelhos
- /api/health activeCampaigns=1 após start
- Telemetria T1: evento `session_started` + `campaign_created` em metrics_events
- Tiefling sheet tem `resistances: ['fogo']` (via `/api/characters/:id`)

### F2 — DM personality 5 estilos (1C)
**Objetivo**: cada personality muda tom de narração perceptivelmente.
**Passos**:
1. Criar 5 lobbies separados, escolher cada personality (sombrio/épico/comédia/noir/pulp)
2. Iniciar campanha em cada → ler primeira narração
3. Anotar 1 frase representativa de cada
**Critério**: tom NITIDAMENTE diferente entre os 5 (épico ≠ comédia ≠ sombrio).
**Validar**:
- Tag de personality aparece no header da campanha (1C-tail)
- Memória RAG do Mestre (`/api/campaigns/:id/memory`) registra fatos
- DM error rate (`/api/metrics/summary`) ≤ 5%

### F3 — Counterspell mecânico (S2 + 2A.2)
**Objetivo**: counterspell anula damage incoming.
**Passos**:
1. Criar mago nv 5 com counterspell preparada
2. Force combate vs inimigo caster (DM deve usar `enemy_casts_spell` antes de damage)
3. Modal counterspell aparece no client (5s window)
4. Clica "Slot 3 ✓"
5. Verifica que damage NÃO aplicou em party
**Critério**: HP da party intacto após contramágica + log "Dano de Fireball ANULADO".
**Validar**:
- Combat event log mostra resolveCounterspell sucesso
- Slot 3 do mago consumido
- pendingEnemySpell limpa no broadcast seguinte
- Round +1 → reaction disponível de novo

### F4 — Dodge real (M3)
**Objetivo**: esquivar reduz hits sucessivos do inimigo.
**Passos**:
1. PJ baixo (AC 12) em combat vs 2 inimigos
2. Ação Dodge no turno do PJ
3. Aguarda 2-3 turnos inimigos → contar hits vs misses
**Critério**: hit rate observado < 30% (sem dodge seria ~50-70%).
**Validar**:
- combat-flag `dodging` aparece em `combatFlags` socket event
- Após próximo turno do PJ, flag limpa
- Log do attackRoll mostra "advantage: false, disadvantage: true"

### F5 — Auto-recap entre sessões (A3)
**Objetivo**: sessão 2+ abre com "Anteriormente..." baseado em facts.
**Passos**:
1. Sessão 1: jogar até DM marcar npc + location + event facts (15-20 min)
2. Sair da campanha
3. Re-joinar → sessionNumber incrementa OU forçar via DB
4. Verificar narração inicial
**Critério**: narração começa com recap de 2-3 facts importantes.
**Validar**:
- `MemoryStore.topImportant(campaignId)` retorna 3+ facts
- `dm.generateRecap()` foi chamado (log server)
- Resposta narração contém menção a NPCs/locais conhecidos

### F6 — Friend invite + coop (A4)
**Objetivo**: convidar amigo por email, ele entra, jogam coop.
**Passos**:
1. User A loga, vai pro profile
2. Form "Convidar pra jogar" → email do User B
3. Toast aparece com devLink (sem Brevo)
4. Copia link, abre incognito como User B → magic link login
5. resolveInvitesForNewUser auto-converte invite em friendship
6. Ambos criam lobby + entram juntos
**Critério**: party panel mostra ambos PJs.
**Validar**:
- `/api/friends` retorna friendship `status: accepted`
- Socket combatFlags broadcast pra ambos
- Chat livre funciona bidirecional

### F7 — Highlight reel HTML export (3A)
**Objetivo**: gerar HTML standalone compartilhável.
**Passos**:
1. Em campanha ativa, DM dispara `mark_highlight` (kill épica ou choice)
2. Profile → seção Highlights → botão "📜 Exportar"
3. Nova aba abre HTML
4. Salva como .html, abre em browser limpo (sem prod rodando)
**Critério**: HTML funciona offline, mobile-friendly (375x812 OK).
**Validar**:
- Cards com border-left colorida por kind
- XSS-safe (testar com `<script>alert</script>` no summary)
- Timeline em ordem cronológica

### F8 — Difficulty dropdown (3B)
**Objetivo**: player escolhe e DM respeita.
**Passos**:
1. Em campanha, dropdown header → "🔴 Mortal"
2. Forçar próximo combate via DM (ação "atacar")
3. Verificar que DM chama `start_combat_balanced({ difficulty: 'deadly' })`
**Critério**: encontro gerado tem XP threshold deadly (≥4x easy).
**Validar**:
- Socket `updateCampaignSettings` recebido
- CampaignState.combatDifficulty persistido
- Encounter builder respeita

### F9 — UI badges (1B)
**Objetivo**: concentration/buffs/rage visíveis no party panel.
**Passos**:
1. PJ clérigo casta Bless (concentration)
2. Bardo dá Bardic Inspiration
3. Bárbaro entra em rage (Class Features bar)
4. Olhar party panel
**Critério**: 3 badges visíveis (🧠 Conc + ✨ buff + 🔥 FÚRIA).
**Validar**:
- CSS classes `.cp-pj-conc / .cp-pj-buffs / .cp-pj-rage` aplicadas
- Rage badge tem animação pulse
- combatFlags broadcast contém 'rage' pro bárbaro

### F10 — Telemetria (T1)
**Objetivo**: eventos registrados, summary acessível.
**Passos**:
1. Jogar ~30 min misturando ações
2. `curl /api/metrics/summary?days=1` com cookie autenticado
**Critério**: response tem `summary.byKind` populado + dmRate.rate < 0.1.
**Validar**:
- `narration_success` >> `narration_error`
- DAU = 1 (user testando)
- session_started + campaign_created > 0

### F11 — Item use catalog (M4)
**Objetivo**: poção cura via id-based.
**Passos**:
1. DM dá `pocao-cura` (via give_item)
2. Inventory modal → usar
3. HP recupera 2d4+2
**Critério**: regen visível, toast info.
**Validar**:
- effectApplied = "Curou X HP"
- item.quantity decremented

### F12 — Enemy ability scores (M1)
**Objetivo**: enemy save vs spells usa scores reais.
**Passos**:
1. Bárbaro casta Hold Person (não tem mas DM dá temp) vs goblin (WIS 8) vs lich (WIS 18)
2. Goblin deveria falhar save fácil, lich quase sempre passa
**Critério**: 10 holds vs goblin = 7+ paralisados; 10 vs lich = 2- paralisados.
**Validar**:
- enemy.abilityScores populado em combatState
- spells-engine usa mod real (não 0)

---

## 3. Bug capture protocol

Pra cada bug encontrado, registrar em `PLAYTEST_BUGS.md`:

```markdown
### BUG-NNN — [título curto descritivo]

**Severidade**: P0 (crash) / P1 (quebra fluxo) / P2 (polish) / P3 (cosmetic)
**Área**: combat / wizard / coop / DM / UI / persistence
**Repro**:
1. [passo exato 1]
2. [passo exato 2]
3. Esperado: X
4. Observado: Y

**Console errors**:
\`\`\`
[colar stack trace ou erro do browser/server]
\`\`\`

**Hipótese inicial**: [se óbvio, em qual arquivo + função provavelmente está]
**Workaround temporário**: [se aplicável]
**Tests cobertos?**: sim/não — qual test file deveria cobrir
```

### Severidade decision tree
- **P0**: app não carrega / WebSocket cai / crash JS no boot / 500 em /api/health → **stop playtest, fix imediato**
- **P1**: feature principal não funciona (counterspell não anula, dodge ignorado, friend invite errors) → **batch fix antes do coop com amigo**
- **P2**: UI quebra em mobile / toast não aparece / animation defeituosa → **batch fix em rodada cleanup**
- **P3**: typo, cor errada, ícone wrong → **acumular, fixar em batch grande**

---

## 4. Fix workflow

### 4.1 Triage (a cada 5-7 bugs registrados)
1. Sort bugs por severidade
2. Identificar **bugs do mesmo arquivo** → fix em batch (1 commit)
3. Identificar **bugs do mesmo domínio** (ex: combat) → 1 batch mesmo se arquivos diferentes
4. P0 sempre interrompe o batch — fixa antes de continuar playtest

### 4.2 Fix loop (por batch)
```
1. git checkout -b fix/playtest-batch-N    # branch por batch
2. Para cada bug do batch:
   a. Adicionar test que falha (TDD reverso — garante não regredir)
   b. Implementar fix
   c. Test passa
   d. Atualizar PLAYTEST_BUGS.md → marcar como ✅ fixed em batch-N
3. npm run typecheck && npm test -- --run    # full suite verde
4. git commit -m "fix(area): batch N — BUG-001, BUG-002, BUG-005 (3 fixes)"
5. git push origin fix/playtest-batch-N → opcional: PR pra review depois
6. Merge em main local + push
7. Aguardar Render rebuild (~3-5 min)
8. Re-test cenários afetados na seção 2
```

### 4.3 Atomic fix (P0 standalone)
Se P0 puro: skip branch, fixar direto em main, push, deploy, re-test.

### 4.4 Hot-patch via env var (sem rebuild)
Se bug é configuração (ex: rate limit muito baixo), Render env edit funciona via Chrome MCP — sem rebuild de código.

---

## 5. Validation loop

Após cada batch de fixes:

### 5.1 Smoke automatizado (1 min)
```bash
npm test -- --run        # 533+ tests verdes
curl -s https://jsgame-drpe.onrender.com/api/health  # uptime baixo = rebuild ok
```

### 5.2 Re-test cenários afetados (cherry-pick)
Não re-testa TUDO — só os cenários da seção 2 cujo bug foi fixed.

### 5.3 Test coverage check
Pra cada bug fixed, garantir test cobre. Atualizar tabela:

| Bug ID | Área | Test file novo/atualizado | Cobertura |
|---|---|---|---|
| BUG-001 | combat | `dodge-mechanic.test.ts` | ✓ |
| ... | | | |

### 5.4 Telemetria sanity
- `/api/metrics/summary?days=1`
- `dmRate.rate` deve estar caindo entre batches
- `narration_error` log deve apontar pra erros conhecidos OU sumir

---

## 6. Exit criteria — quando declarar "shippable"

Tudo abaixo precisa estar ✓ pra considerar playtest concluído:

- [ ] **0 bugs P0/P1 abertos**
- [ ] **≤ 5 bugs P2 abertos** (todos com workaround documentado)
- [ ] **Tests verdes**: 533+ count, 100% pass rate
- [ ] **DM error rate** ≤ 10% nos últimos 50 narration_* events
- [ ] **Friend invite** end-to-end testado (1 user A → invita B → B aceita → coop)
- [ ] **Counterspell** validado em pelo menos 3 combates distintos
- [ ] **5 personalities** validadas (1 narração de cada anotada como "OK ou nope")
- [ ] **Mobile** (preview_resize 375x812): wizard + lobby + campaign + combat OK
- [ ] **Auto-recap** dispara em sessão 2 e narra fact conhecido

### Quando NÃO bate exit criteria
Documentar gaps no `HANDOFF_2026-XX-XX_playtest-incompleto.md` + listar bugs abertos + priorizar próxima sessão.

---

## 7. Cheatsheets úteis

### Chrome MCP — comandos rápidos
```ts
// Click via JS (mais robusto que coordenadas)
javascript_tool: (() => { document.querySelector('[data-test=foo]').click() })()

// Verificar socket state
javascript_tool: window.__socket?.connected

// Pegar última narração
javascript_tool: document.querySelector('.camp-narration:last-child')?.innerText
```

### DB queries pra debug
```sql
-- Top facts da campanha
SELECT kind, importance, text FROM memory_facts WHERE campaign_id = 'X' ORDER BY importance DESC LIMIT 10;

-- Friends de user
SELECT * FROM friendships WHERE user_a = 'U' OR user_b = 'U';

-- Telemetria últimas 24h
SELECT kind, COUNT(*) FROM metrics_events WHERE created_at > strftime('%s', 'now', '-1 day')*1000 GROUP BY kind;
```

### Forçar cenários (Shell Render)
```bash
# Forçar sessionNumber > 1 pra testar A3 (auto-recap)
UPDATE campaigns SET state = json_set(state, '$.sessionNumber', 2) WHERE id = 'X';
```

---

## 8. Padrões de bug típicos esperados

Baseado nas features novas, hipóteses de onde bugs vão aparecer:

- **2A counterspell**: timing race entre `enemy_casts_spell` e `apply_damage` no DM tool order — DM pode ainda aplicar damage antes do server processar reaction.
- **A3 auto-recap**: latência alta (LLM call adicional + LLM normal de abertura = 8-12s antes da narração inicial).
- **A4 friend invite**: `resolveInvitesForNewUser` pode falhar se user já existia antes (PJs anon legacy).
- **B7 tutorial**: trigger condition `!this.currentState && hasFirstNarration` pode disparar 2x em coop quando ambos joinam simultâneo.
- **M1 enemy AS**: scores inferidos podem estar absurdos pra monstros legacy (ex: gargula INT 12 baseado em CR 4 + bias construto).
- **B6 toast**: stack vertical pode acumular muitos toasts em coop se vários erros simultâneos.
- **T1 telemetria**: hooks parciais — só `session_started` e `narration_*` estão tracking. Falta combat_won/lost, etc.

---

## 9. Postmortem template (fim do playtest)

```markdown
# Playtest YYYY-MM-DD — Postmortem

## Tempo gasto
- Setup: X min
- Test execution: X min
- Fix batches: X batches × Y min cada
- Total: ~X horas

## Bugs encontrados
- P0: N
- P1: N
- P2: N
- P3: N

## Bugs fixed nesta sessão
- N de N total ✓

## Padrões observados
- [hipótese 1]
- [hipótese 2]

## Features que precisam de re-test futuro
- [feature 1]: motivo
- [feature 2]: motivo

## Próximos passos
- [TODO 1]
- [TODO 2]
```
