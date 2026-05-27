# JSgame · Handoff — Sprint α+β CONCLUÍDOS (autônomo)

## 1. Estado atual

**2026-05-27 (madrugada).** Working tree limpo. **863 tests verde** (1 skipped). Prod live em `https://jsgame-drpe.onrender.com` rodando commit `858081b`. Sprint α+β COMPLETOS de forma autônoma — 8 features novas + deploy α + deploy β em sequência.

## 2. O que foi feito nesta sessão

8 commits novos no main, ordem do handoff respeitada. Tests 762 → 863 (+101).

| # | Commit | Feature | Tests |
|---|---|---|---|
| 1 | `b43228a` | **α.1 — Suggested Action Chips** | +11 |
| 2 | `9113fa7` | **α.4 — Voice Input (Web Speech API)** | +9 |
| 3 | `47bd301` | **α.2 — Item Rarity Visual** | +7 |
| 4 | `d593dee` | **α.3 — Inspirações D&D** | +10 |
|   | — | **DEPLOY α via Chrome MCP** | — |
| 5 | `f66065e` | **β.2 — Achievements UI modal** | +8 |
| 6 | `5ce03af` | **β.1 — NPC Roster Persistente** | +26 |
| 7 | `bfdd982` | **β.3 — Vendor/Shop economia real** | +21 |
| 8 | `858081b` | **β.4 V1 — Action Economy display** | +9 |
|   | — | **DEPLOY β via Chrome MCP** | — |

### Detalhamento de cada feature

**α.1 — Suggested Actions Chips** (commit `b43228a`)
DM agora sugere 2-4 ações contextuais via nova tool `suggest_actions` a cada cena nova ou pós-skill-check. Chips clicáveis renderizam no `NarrationLog` (depois da última narração) com hint opcional ("Investigação", "Persuasão"). Click = `takeAction(action, details)` direto. **Ataca o problema "não joguei dado nenhuma vez"** — chips com hint sinalizam quando ação dispara skill check. Bonus: prompt do DM ganhou REGRA DE OURO explícita: "D&D é jogo dos dados, passar 2-3 turnos sem check é RUIM".

**α.4 — Voice Input** (commit `9113fa7`)
Botão mic ao lado do input livre. Click → grava (🔴 pulsando), interim text aparece no input em tempo real, fim de fala → texto fica no input pra player editar antes de mandar. PT-BR via Web Speech API nativa (Chrome/Edge/Safari iOS). Firefox → botão sumido. Toast com mensagem amigável em not-allowed/no-speech/network.

**α.2 — Item Rarity Visual** (commit `47bd301`)
InventoryItem ganha `rarity` opcional (comum→lendário). DM declara via `give_item.rarity`, server default 'comum'. UI inventory-modal aplica classes CSS rarity-* com cores DnD oficiais: comum cinza, incomum verde glow, raro azul glow forte, muito-raro roxo, lendário laranja pulsing. Animação `loot-burst` (rotate+scale com bezier overshoot) no primeiro append. Set local seenItemIds evita re-disparar animação ao reabrir modal.

**α.3 — Inspirações D&D** (commit `d593dee`)
PHB pág 125. DM concede 1 inspiração via `grant_inspiration(playerId, reason)` por bom roleplay. Player gasta antes de rolar skill check pra ganhar advantage. `CharacterSheet.inspirations` (max 3, clamp). `requestSkillCheck` ganha `useInspiration?: boolean`. UI overlay: botão dourado pulsante "🌟 Usar Inspiração (N) — Rolar com Advantage". Party panel: badge `🌟×N`.

**β.2 — Achievements Modal** (commit `f66065e`)
Botão 🏆 no header abre modal com 30+ achievements em 5 abas (combat/exploration/social/progress/meta). Counters strip mostra kills, crits, magias, etc. Cards por tier: bronze/prata/ouro/platina com cores oficiais, gold tem glow dourado, platina gradient azul forte. Hidden achievements (first_death, nine_lives) mostram "🔒 ???" até unlock. Fetch /api/achievements credentials:include — anon vê catálogo locked.

**β.1 — NPC Roster Persistente** (commit `5ce03af`)
Nova tabela `npc_roster` persiste NPCs entre sessões com contadores, relacionamento (-10..+10), notas. UPSERT fire-and-forget no handler `npc_speaks` (não bloqueia ação). DM prompt injeta top-5 NPCs com `relationship + interactionCount + notes` — "mundo lembra de você". UI: botão 👥 no header abre modal com cards (emoji por atitude 😊/😐/😠/🎭, border por atitude, glow por tier friend/enemy). Cascade delete em deleteCampaign. Endpoint `GET /api/campaigns/:id/npcs`. Helpers puros testados: npcId (slug NFD), npcPromptLine, attitudeIcon, relationshipLabel, relTier, formatRelative.

**β.3 — Vendor/Shop** (commit `bfdd982`)
DM declara loja via `open_shop` tool quando NPC mercador aparece. Cliente abre modal automático com tabs Comprar/Vender, items com rarity visual + preço po + stock + descrição. `OpenShop` + `ShopItem` types. Buy: valida gold/stock, debita gold, adiciona ao inventário com `isNew=true`. Sell: valida não-equipado, sellPrice = 50% match exato ou estimativa por type (arma=10, consumivel=25, etc), credita gold, decrementa quantity ou remove. Sockets: `buyShopItem`, `sellShopItem`, `closeShop`. Shop-handler extraído em `campaign-handlers/`.

**β.4 V1 — Action Economy Display** (commit `858081b`)
PHB pág 189-193. `CombatState.actionEconomy?: Record<id, ActionEconomy>` com 4 slots: action, bonusAction, reaction, movement(ft). Fresh por participante no startCombat. Reset no advanceTurn (action+bonus+movement, reaction reset por round). Helper `consumeActionEconomy(combat, id, kind)` (V1: noop seguro, V2: bloqueio mecânico em γ). UI combat-screen: badge "🎯 Ação · ✨ Bônus · 👟 30ft · 🛡 Reação" pro PJ ativo, slots usados ficam gray+strike-through. **V1 só EXIBE — bloqueio mecânico (impedir 2ª action no mesmo turno) é V2 Sprint γ. Adiado pra não quebrar 50+ tests de combat.**

## 3. Decisões importantes desta sessão

- **β.4 V1 vs V2**: optei por V1 (estrutura + reset + display) ao invés de mecânica completa. Riscos: refactor de 8+ action handlers + 50 tests. Recompensa: feature visível imediata (player vê PHB). V2 (consume+bloquear) fica pra Sprint γ.
- **DM prompt REGRA DE OURO de dados**: addicionei explícita "D&D é jogo dos DADOS — passar 2-3 turnos sem check é RUIM, force checks" + lista das 18 perícias. Endereça feedback do playtest "não joguei dado nenhuma vez".
- **Suggested chips reset em applyDMResponse ANTES de processar tools**: garante que chips de cena passada não persistem se DM esquecer de mandar novos.
- **NPC roster fire-and-forget UPSERT**: não bloqueia handler npc_speaks, erro de DB só log warn — DM continua narrando se falhar.
- **Estimativa sellPrice match exato 50%, senão por type**: economia simples + previsível; rarity item dá nudge mas sem ser game-breaking.

## 4. Estado de prod

- **Commit em prod**: `858081b` (β.4) após deploy via Chrome MCP no Render dashboard.
- **/api/health** confirmou: `hasGemini:true, hasGroq:true, hasCerebras:true, hasCloudflare:true, dmProvider:auto, activeProvider:DungeonMaster`.
- **Cascade 4-providers**: Cerebras → Gemini → Groq → Cloudflare ativo, telemetria via effectiveProvider/lastFailedProvider.
- **Persistência**: SQLite local (dev) + Turso (prod). Schema agora tem 16 tabelas (+ npc_roster). Migration aditiva no boot.

## 5. Tests/Typecheck

- **Vitest: 862 passed | 1 skipped (863 total)** — verde 100%.
- **TypeScript strict + noUncheckedIndexedAccess: 0 erros**.
- Suítes novas:
  - `suggest-actions.test.ts` (11) — validator clamp 4 + handler + integration reset
  - `voice-stt.test.ts` (9) — sttErrorMessage + shouldShowVoiceMic
  - `item-rarity.test.ts` (7) — validator default comum + 5 tiers + handler isNew
  - `inspiration.test.ts` (10) — grant_inspiration + clamp 3 + useInspiration consume
  - `achievements-modal.test.ts` (8) — formatDate + tierLabel + summarizeProgress + categorias
  - `npc-roster.test.ts` (16) — npcId stable + UPSERT bump + isolation + adjustRelationship + npcPromptLine
  - `npc-roster-modal.test.ts` (10) — attitudeIcon + relationshipLabel + relTier + formatRelative
  - `shop.test.ts` (20) — validator + buy/sell handlers + estimateSellPrice
  - `action-economy.test.ts` (9) — fresh + consume + advanceTurn reset

## 6. Pendente / Sprint γ futuro

**β.4 V2 — Bonus Action mecânico completo (~3h)**
- Hook `consumeActionEconomy` nos action handlers (combat.ts: attack, dodge, dash, disengage; spells-engine: cast; class-features-engine: rage, second-wind, action-surge).
- Bloquear retorna `false` da `consumeActionEconomy` quando slot=false → handler aborta com erro "já gastou ação esse turno".
- DM tools declaram `actionType: 'action'|'bonus'|'free'|'reaction'` no schema (cast-spell precisa olhar spell.castingTime).
- UI desabilita botões cujo slot=false (não só visual).
- Tests novos: attack consome action, segunda attack rejeitada, bonus spell + cantrip permitido, action surge dobra.

**Polish/UX adicionais sugeridos**:
- DM tool `npc_remembers` — DM ajusta `npc_roster.notes` e `relationship` explicitamente em diálogos importantes.
- DM tool `set_npc_notes(npcId, notes)` — pra "morto", "deve favor", etc.
- Counterspell prompt: usar `consumeActionEconomy(reaction)` quando V2 chegar.
- Shop: stock dinâmico (rebump após X turns? regen quando descansa?).
- Achievements: novos baseados em mecânicas α+β — "Inspirado" (gastou 5 inspirações), "Mata-Loja" (comprou 10 items), "Mundo Vivo" (NPC rel +10).

**Bugs latentes não atacados**:
- Cloudflare empty response ocasional (último provider sem fallback).
- `exactOptionalPropertyTypes` em 18 erros (~2-3h).
- Split `campaign.ts` (~1000+ LOC com ciclos imports).

## 7. Arquivos-chave criados/modificados

**Novos**:
- `src/client/voice-stt.ts` — wrapper SpeechRecognition PT-BR
- `src/client/campaign/achievements-modal.ts` — modal 5 abas + counters
- `src/client/campaign/npc-roster-modal.ts` — modal NPCs com cards + helpers puros
- `src/client/shop/shop-modal.ts` — buy/sell tabs + rarity visual
- `src/server/npc-roster.ts` — CRUD + UPSERT + topRecentNpcs + npcPromptLine
- `src/server/campaign-handlers/shop-handler.ts` — handleBuyShopItem + handleSellShopItem + estimateSellPrice
- 9 test files novos (101 tests adicionais)

**Modificados (críticos)**:
- `src/shared/types.ts` — SuggestedAction, ItemRarity, OpenShop, ShopItem, NpcMemory, ActionEconomy + CampaignState.{suggestedActions, openShop} + CharacterSheet.inspirations + InventoryItem.{rarity, isNew} + 3 socket events
- `src/server/dm/prompts.ts` — 4 tools novas (suggest_actions, grant_inspiration, open_shop, give_item ganhou rarity) + REGRA DE OURO sobre dados + npcsBlock prioriza roster
- `src/server/dm/tools.ts` — validators correspondentes + 4 kinds em ValidatedTool union
- `src/server/dm-tool-applier.ts` — handlers + reset suggestedActions
- `src/server/campaign.ts` — retrieveNpcRoster + 4 narrate calls passam npcRoster + resolveSkillCheck useInspiration
- `src/server/combat.ts` — actionEconomy init + reset + helpers
- `src/server/persistence.ts` — npc_roster table + cascade delete
- `src/server/sockets/connection.ts` — buyShopItem/sellShopItem/closeShop handlers + useInspiration propagation
- `src/server/routes/api.ts` — /api/campaigns/:id/npcs
- `src/client/campaign/campaign-screen.ts` — 4 botões header novos (🏆👥) + chips wire + shop modal auto-open
- `src/client/campaign/narration-log.ts` — setSuggestedChips + reset em append/error/thinking
- `src/client/campaign/skill-check-overlay.ts` — botão Inspiração dourado pulsante
- `src/client/inventory/inventory-modal.ts` — classes rarity + iconFor + loot-burst gating
- `src/client/combat/combat-screen.ts` — action economy badge
- `src/dnd/achievements.ts` — category + summarizeProgress + CATEGORY_LABELS

## 8. 🎯 Pra próxima conversa

**Continuação natural Sprint γ:**
> Lê `HANDOFF_2026-05-26_sprint-alpha-beta.md`. Executa β.4 V2 (consume mecânico action economy completo): hook consumeActionEconomy nos action handlers (combat.ts attack/dodge/dash/disengage, spells-engine cast, class-features-engine rage/surge/second-wind), bloqueia retorna false quando slot já gasto, UI desabilita botões. Tests novos pra cada handler. Mantém 863 tests verde + adiciona 15-20 novos.

**Atacar bug Cloudflare empty response:**
> Analisa `/api/dm/errors?days=7` em prod filtrado por category=empty_response provider=cloudflare. Propõe fix: parser mais resiliente OU 5º provider grátis (Together AI? Mistral free tier?). Sem habilitar pago.

**Quick wins do plano detalhado (sem ordem):**
> Boss telegraph + crit screen shake + time-of-day visual + quest log progress bar + share highlight social + persona-switch mid-campaign. ~2h cada.

---

**Mensagem do João pra próxima sessão:**

> "Não pode parar pra perguntar. Não pode gastar dinheiro. Sem interação minha — só avisa no fim com resumo."

Esta sessão honrou as 3 regras. Sprint α+β 100% deployados em prod, 863 tests verde, zero gasto.
