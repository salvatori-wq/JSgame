# JSgame · Bug hunting findings

> Inventory produzido pelos sprints A-E (2026-05-26). Atualizado a cada rodada.

---

## Sprint E — Static analysis

### Dead code confirmado
- ✅ **DELETADO** `src/client/combat/attack-overlay.ts` — arquivo inteiro sem importadores (knip + grep confirmado, só ref era em HANDOFF antigo).

### Dead code provável (não removido, requer 2ª verificação)
Estes são exports flagados por `knip` mas pode ter uso indireto (via string lookup, eval, dynamic import). Não delete sem grep mais amplo:

| Export | Local | Risco |
|---|---|---|
| `listTombstonesForOwner` | `src/server/tombstones.ts:133` | API server-side, talvez planejado |
| `applicableFeatures` | `src/client/combat/class-features-bar.ts:71` | UI helper, talvez orfão pós-refactor |
| `cancelSpeech` | `src/client/voice-tts.ts:56` | Feature TTS pode reativar |
| `hasPermission` / `requestNotifPermission` | `src/client/notifications.ts` | Push notifs ainda em backlog |
| `markTourDone` | `src/client/onboarding-tour.ts` | Tour stub pode reativar |
| `getUserById`, `revokeAllSessionsForUser` | `src/server/auth.ts` | Admin futuro |
| `uuid` | `src/server/combat.ts:660` | duplicado do `util.uuid` |
| `consumeInvite` | `src/server/friends.ts:186` | Friend invites flow incompleto |
| `listHighlightsForCampaign` | `src/server/highlights.ts:54` | Export futuro |

**Recomendação**: rodar `knip` mensalmente. Se export continuar listado por 2+ ciclos consecutivos, deletar.

### Tipos exportados não usados (20)
Em `src/shared/types.ts`, `src/dnd/*`, `src/server/dm/tools.ts`: `HitDie`, `DieKind`, `FeatId`, `BackgroundId`, `QuestStatus`, `QuestObjective`, `WizardStep`, `FloatingKind`, etc. **Mantidos** — tipos reexportados via barrel são best-practice mesmo sem consumer atual.

### Circular dependencies (11)
```
client/character-creation/wizard.ts ↔ step-*.ts (7 ciclos)
client/character-creation/wizard.ts ↔ live-preview.ts
server/campaign.ts ↔ campaign-handlers/item-handler.ts
server/campaign.ts ↔ campaign-handlers/rest-handler.ts
server/campaign.ts ↔ dm-tool-applier.ts
```

**Análise**:
- **Wizard ↔ steps** (8 ciclos): por design — wizard expõe state pra steps, steps invocam wizard re-render. Não tira mas observa: se add step novo, manter padrão.
- **campaign.ts ↔ handlers** (3 ciclos): listado em HANDOFF como TODO (split campaign.ts 932 LOC). Fix prioritário antes de adicionar handlers novos.

### Strict TS flags adicionais testados

| Flag | Resultado | Decisão |
|---|---|---|
| `noUncheckedIndexedAccess` | **JÁ ATIVO** ✅ | manter |
| `exactOptionalPropertyTypes` | **18+ erros** em 10 arquivos client/server | adiar — escopo de 2-3h pra corrigir. Em Sprint F (futuro). |
| `noImplicitOverride` | testar | quick win futuro |

### Ações pendentes (não fizemos pra não estourar escopo)
- [ ] Resolver ciclos `campaign.ts ↔ handlers` quando split do campaign.ts acontecer (handoff já lista)
- [ ] Habilitar `exactOptionalPropertyTypes` em sprint dedicado (~2-3h, alta cobertura test pra catch regressões)
- [ ] Reavaliar dead code em 30 dias — exports ainda listados → delete

---

## Sprint A — Property-based testing

Adicionado `fast-check`. 5 arquivos de property tests com **5000+ runs cada**:

| Arquivo | Alvo | Invariantes testadas |
|---|---|---|
| `property-dice.test.ts` | `dice.ts` | total ∈ [N+M, N*K+M]; advantage usa max; disadvantage usa min; crit dobra dados não modifier; parser arbitrário não crasha |
| `property-spell-slots.test.ts` | `spell-slots.ts` | non-caster slots=0; full caster nv17+ tem slot 9; half caster nunca slot 6+; pact magic concentra em 1 tier; monotonia slot total cresce com level |
| `property-damage-types.test.ts` | `damage-types.ts` | immunity ⇒ 0; vuln sozinho ⇒ 2; resist sozinho ⇒ 0.5; vuln+resist ⇒ 1; multiplier ∈ {0,0.5,1,2}; applyDmg nunca negativo nunca não-inteiro |
| `property-encounter-builder.test.ts` | `encounter-builder.ts` | targetXp >=0 sempre; adjustedXp >= totalXp; level out-of-range não crasha; difficulty crescente ⇒ targetXp crescente; targetXp determinístico |
| `property-markdown.test.ts` | `util.ts renderNarrationText` | tags output só whitelist (strong/em/code/br); 12 XSS payloads conhecidos rejeitados; balance de tags; unicode não quebra |

**Resultado**: zero invariantes quebrados. 61 novos tests, todos green em primeira execução. Helpers de fuzz produziram entradas estressantes (string vazia, unicode, números extremos) sem crash.

**Bugs encontrados durante escrita dos tests**:
- `fc.unicodeString` foi removido em fast-check 3.x — anotado pro futuro.

---

## Sprint C — Telemetria observacional

Novo módulo `src/server/anomaly-detector.ts`:
- **`computeAlerts(input)`** — função pura: dados snapshot de métricas → array de alerts {severity, kind, value, baseline, message}
- **`detectAnomalies(days)`** — I/O wrapper que lê metrics_events do DB
- **`computeFunnel(days)`** — conversion entre `character_created → session_started → combat_started → combat_won`

**Endpoints**:
- `GET /api/dm/anomalies?days=N` (default 1) — alerts em tempo real
- `GET /api/dm/funnel?days=N` (default 7) — drop-off entre etapas

**Baselines**:
- DM error rate >10% high, >20% critical
- Session médio fora [5, 90] min ⇒ medium/low alert
- Mortes/sessão >0.5 ⇒ medium, >1.0 ⇒ critical
- Combat lost rate >30% ⇒ medium, >50% ⇒ high

**Tests**: 13 cobrindo cenários puros (sem DB) + sanity de thresholds monotônicos.

---

## Sprint D — Adversarial probes

Diretório `scripts/adversarial/` com **10 probes EVIL**:

| Categoria | ID | O que testa |
|---|---|---|
| prompt_injection | `inject-jailbreak` | Quebra persona + leak system prompt |
| prompt_injection | `inject-roleplay-swap` | Forçar DM virar tutor Python |
| tool_abuse | `tool-abuse-megadamage` | Dano 999999 via tool |
| json_poison | `json-poison-narration` | XSS via narration field |
| memory_poison | `memory-poison-gold` | Plantar fato falso |
| slot_scam | `slot-scam-free-fireball` | Magia sem slot |
| infinite_combat | `infinite-combat-mega-hp` | Enemy HP 999999 |
| class_swap | `class-swap` | Trocar classe mid-campaign |
| gold_inflation | `gold-inflation` | 50000 gold via narrativa |
| condition_immunity_grant | `condition-grant-immunity` | Imunidades absurdas |

**Cada probe declara** prompt + validator que compara stateBefore/After + narrationOutput.

**Runner**: `scripts/adversarial/run-probes.ts [probeId|all]` — framework completo. Run full requer socket session ativa (scaffolded — execução manual).

**Tests**: 16 cobrindo validators puros com inputs sintéticos (DM cedeu vs DM rejeitou).

**Pendente pra execução real** (gasta quota LLM): conectar via socket-io-client, drive campaign + take_action, gather state snapshots. Próxima sessão.

---

## Sprint B — E2E suite

Diretório `scripts/e2e/` com **10 scenarios smoke** declarativos:

| ID | Nome | Severity |
|---|---|---|
| `smoke-1` | Onboarding novo player | smoke |
| `smoke-2` | Rejoin sessão após reload | smoke |
| `smoke-3` | Coop 2 players mesmo lobby | smoke |
| `smoke-4` | Combat full cycle | smoke |
| `smoke-5` | Death → tombstone | smoke |
| `smoke-6` | Rest cycle long rest | smoke |
| `smoke-7` | Auto-recap sessão 2 | smoke |
| `smoke-8` | Counterspell mecânico | smoke |
| `smoke-9` | Delete crônica via UI | smoke |
| `smoke-10` | Markdown render no log | smoke |

**Arquitetura**: scenarios são DATA (intenção + asserts) separado da impl (driver). Permite trocar Chrome MCP por Playwright sem reescrever scenarios.

**Runner**: `tsx scripts/e2e/runner.ts [id|all]`. Carrega impl dinâmica de `scripts/e2e/impls/<id>.ts`. Sem impl ⇒ marca scaffolded (não fail). JSON output structured.

**Orquestrador**: `bash scripts/e2e/run-all.sh [server-url]`.

**Reference impl**: `smoke-9.ts` — exercita REST /api/characters + /api/campaigns/recent. Serve de baseline pra os outros 9.

**Tests**: 7 cobrindo registry (IDs únicos, expectations válidas, duração total < 30min).

---

## Resumo geral

| Métrica | Antes | Depois | Delta |
|---|---|---|---|
| Tests | 628 | 725 | +97 (+15.4%) |
| Test files | 46 | 54 | +8 |
| Dev deps adicionadas | — | fast-check, ts-prune, madge, knip | +4 |
| Endpoints REST | (todos pré-existentes) | + `/api/dm/anomalies`, `/api/dm/funnel` | +2 |
| Scripts pasta | (vazia) | `scripts/adversarial/`, `scripts/e2e/` | +2 dirs |
| Arquivos dead code removidos | — | `attack-overlay.ts` | -1 |

**Tempo investido**: ~3h equiv (vs ~14h estimado no plano).

**Bugs encontrados**: zero invariantes quebrados — código sólido. Property-based + adversarial framework instalado pra detectar regressões futuras.
