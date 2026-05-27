# JSgame · Handoff — Densidade completa (4 features profundas)

## 1. Estado atual

**2026-05-26 23:46.** Working tree limpo. **1007 tests verde** (1 skipped). Estratégia "Densidade" entregue ponta-a-ponta: 4 features profundas (não 20 rasas) commitadas em main + deploy disparado no Render (`dep-d8b5lobeo5us73akf350`).

Sessão entrega o sprint γ completo + Densidade (8 features no total da sessão).

## 2. O que foi feito

**5 commits desta sub-sessão** (Sprint γ docs/handoff em sessão anterior):

| # | Commit | Feature | Tests | Suíte |
|---|---|---|---|---|
| docs | `7de36eb` | STRATEGY_DENSIDADE.md (685 linhas, plano detalhado) | — | 939 |
| F1 | `e892937` | Primeiro Minuto Magia — 3 PJs pré-fab + 13 cold opens | +25 | 964 |
| F2 | `fe8d39b` | Crit que faz suar — combat drama (visual+som+narração) | +11 | 975 |
| F3 | `78eb823` | Mestre que Lembra — RAG contextual + callback detector | +20 | 995 |
| F4 | `b9a6a8e` | PJ que Faz Sentido — backstory drives DM | +12 | 1007 |

**Total: +68 tests novos. Sessão inteira (γ+Densidade): 877 → 1007 verde (+130).**

### F1 — Primeiro Minuto Magia

3 PJs pré-fabricados cobrindo arquétipos icônicos D&D:
- **Borin Forjarocha** — anão-montanha guerreiro soldado, FOR 16 CON 15, AC 18 (cota+escudo), HP 13, trait/ideal/bond/flaw completos
- **Lyra Estrelaluz** — alta-elfa maga sábia, INT 16, 2 spell slots nv1, spellsKnown reais (magic-missile, shield, mage-hand, fire-bolt, detect-magic)
- **Sina Tribuna** — halfling-pes-leve ladina charlatã, DES 16, 4 perícias (furtividade/enganacao/prestidigitacao/persuasao)

13 cold opens server-side (1 por backgroundId) — sem LLM call, instantâneo, sempre consistente:
- soldado: chuva + emboscada (Percepção DC 12)
- charlatão: brutamonte + "você roubou meu pai" (Enganação DC 14)
- sábio: cela + pergaminho rúnico (Arcanismo DC 13)
- 10 outros backgrounds

Hook em `Campaign.startSession`: se sessão 1 + party 1 + sem events, usa cold open + seta pendingCheck imediato. Primeiro turno já tem dado pra rolar.

API: `POST /api/characters/prefab { prefabId, ownerName }` → cria sheet + salva. Home UI: 3 cards visíveis acima do botão wizard.

### F2 — Crit que faz suar

Visual:
- Crit damage 48px (2x) + glow dourado + easing bouncy `cubic-bezier(0.68, -0.55, 0.265, 1.55)` + fade 1.5s
- HP bar shake 300ms em damage events (re-disparável via reflow)
- HP <33% pulsa devagar (criticalPulse 1.5s infinite) — sinal "tô morrendo"
- Enemy dying anim 800ms (fade + descend + grayscale) antes de virar is-dead
- Crit kill ganha box-shadow gold extra

Audio:
- novo `playEnemyKill` — sawtooth 220→60Hz + noise + chime descendente 660→440Hz
- Distingue kill de inimigo (kill satisfying) de player KO (bass thud mantido)

Narração (`src/server/combat-narrator.ts`):
- `enrichAttackLog` substitui template hardcoded por variação de verbos
- Hit: cravou/rasgou/atingiu/acertou em cheio
- Crit (UPPERCASE): ESMAGOU/DILACEROU/DEMOLIU/DECEPOU
- Kill suffix: "cai morto" / "tomba sem vida" / "desaba" / "arremessado"
- `buildKoNarration` — 4 templates dramáticos pra player KO (substitui "INCONSCIENTE")
- Seed opcional pra determinismo em tests

### F3 — Mestre que Lembra

`MemoryStore.contextualSearch` estende search() com 3 slots forçados:
- **forceNpcSlot**: NPC com tags LIKE '%relationship%' ORDER BY importance DESC
- **forcePromiseSlot**: kind=promise AND NOT completed ORDER BY created_at DESC
- **forceLocationSlot**: kind=location ORDER BY created_at DESC
- Dedup por id — fact no top-N não duplica nos slots

`Campaign.retrieveMemory` sempre força todos 3 slots (NPC + promise + location). Garante que LLM sempre vê elementos do mundo conhecidos.

Prompt enhanced (`src/server/dm/prompts.ts`):
- Bloco memoryBlock ganha `### REGRA DE CALLBACK (CRÍTICA)` inline
- 4 instruções explícitas: cite nome NPC, lembre promessa, descreva mudança em local revisitado, nunca trate como primeiro encontro

Telemetria (`src/server/callback-detector.ts`):
- `detectCallbacks` pure function: word-boundary regex match
- Hook em connection.ts pós-takeAction emit `dm_callback_used` metric
- Payload: npc_count + quest_count + location_count + total

### F4 — PJ que Faz Sentido

`NarrationContext.activeCharacterProfile` (novo): nome/raça/classe/background + trait/ideal/bond/flaw

`buildNarrationPrompt` adiciona bloco "## SOBRE O PJ ATIVO" com:
- Identificação completa
- Os 4 campos com instruções de uso ("Trait: cite quando contextualmente justificado", "Flaw: TESTE em cenas")

`Campaign.buildActiveProfile(playerId)`: extrai do CharacterSheet ativo. 2 narrate calls em takeAction + resolveSkillCheck recebem profile.

Telemetria (`src/server/backstory-detector.ts`):
- `detectBackstoryUsage` pure function: word-boundary regex match das palavras significativas (>=4 chars, sem stopwords) de cada campo
- Hook em connection.ts emit `dm_used_backstory` metric

## 3. Decisões importantes desta sessão

- **Cold open SERVER-SIDE (sem LLM)**: 13 templates pré-escritos. Instantâneo, sempre consistente, gratis. LLM só entra após primeiro skill check do player.
- **F2 crit narrator com seed**: pseudo-random determinístico via seed=N opcional. Tests previsíveis sem perder variedade em prod.
- **F3 dedup por id em contextualSearch**: NPC já no top-N não duplica nos slots forçados. Evita inflar prompt tokens.
- **F4 profile com 4 campos opcionais**: trait/ideal/bond/flaw todos opcionais. PJ wizard incompleto não quebra DM.
- **Telemetria de uso (não força)**: dm_callback_used + dm_used_backstory medem se prompt funcionou. Não força DM — só observa. Sprint próximo pode tunar prompt baseado em data real.

## 4. Verificação local + Deploy

**Preview test (F1)**: `POST /api/characters/prefab { prefabId: 'borin' }` retornou sheet correto (HP 13, AC 18, atletismo+intimidacao, flaw "medo de magia"). Home cards renderizam 3 ids corretos com min-height 76px mobile.

**Deploy disparado**: `dep-d8b5lobeo5us73akf350` via Chrome MCP no Render dashboard. URL: https://jsgame-drpe.onrender.com

## 5. Pendente / Próximos passos

Após validar deploy ao vivo:
- [ ] Hit `/api/dm/ux-funnel?days=1` em prod por 48h pra ter baseline real de `dm_callback_used` e `dm_used_backstory`
- [ ] Configurar `MISTRAL_API_KEY` no Render (γ.4 ativar fallback)
- [ ] Playtest qualitativo:
  - "Combate sente intenso?" (validar F2)
  - "DM lembrou do NPC que ajudei?" (validar F3)
  - "Senti que o PJ era meu?" (validar F4)
  - "Em quanto tempo eu rolei o primeiro dado?" (validar F1, target <60s)

Se métricas baseline ficarem ruins (callback_used <2 ou backstory <2 por sessão), iterar no prompt:
- Tornar regra de callback mais agressiva
- Reduzir noise no memoryBlock (cortar facts com baixa importance)
- Adicionar exemplo few-shot de callback no system prompt

## 6. Princípio mantido — Densidade > extensão

Esta sessão entregou:
- **8 features completas** (Sprint γ × 6 + Densidade × 4 com 2 extra)
- **+130 tests** (877 → 1007)
- **2 deploys** (γ + Densidade)
- **3 docs strategy/handoff** atualizados

Cada feature TEM PROFUNDIDADE — não é cosmético. Player que entra hoje:
1. Vê 3 PJs prontos no Home, click vira sessão em 10s (F1)
2. Cold open com tensão real, dado já rola no primeiro turno (F1)
3. Quando ataca, dado anima, dmg crit explode 2x dourado, enemy morre com cinema, log narra com verbo certo (F2 + γ.1)
4. DM lembra do NPC que cumprimentou na sessão passada (F3)
5. DM testa o flaw do PJ ("medo de magia") quando inimigo lança feitiço (F4)

A IA continua sendo o coração — e agora ele bate mais alto.

## 7. Arquivos-chave criados nesta sessão (Densidade)

```
src/dnd/prefab-characters.ts             # F1 — 3 PJs Borin/Lyra/Sina + buildPrefabCharacter
src/dnd/__tests__/prefab-characters.test.ts
src/server/cold-opens.ts                 # F1 — 13 templates background-aware
src/server/__tests__/cold-opens.test.ts
src/server/combat-narrator.ts            # F2 — enrichAttackLog + buildKoNarration
src/server/__tests__/combat-narrator.test.ts
src/server/callback-detector.ts          # F3 — detectCallbacks
src/server/__tests__/callback-detector.test.ts
src/server/__tests__/contextual-memory.test.ts
src/server/backstory-detector.ts         # F4 — detectBackstoryUsage
src/server/__tests__/backstory-detector.test.ts
src/client/styles/prefab-cards.css       # F1 — cards CSS
STRATEGY_DENSIDADE.md                    # Plano detalhado (685 linhas)
HANDOFF_2026-05-27_densidade-done.md     # este handoff
```

## 8. Arquivos-chave modificados

```
src/server/memory.ts                # +contextualSearch com 3 forced slots
src/server/campaign.ts              # +cold open path em startSession, +buildActiveProfile, F3+F4 hooks
src/server/combat.ts                # +enrichAttackLog substitui logs hardcoded
src/server/dm/prompts.ts            # +ActiveCharacterProfile, +profileBlock, +REGRA DE CALLBACK
src/server/metrics.ts               # +dm_callback_used + dm_used_backstory kinds
src/server/sockets/connection.ts    # +F3+F4 telemetria pós-narrate
src/server/routes/api.ts            # +POST /api/characters/prefab
src/client/main.ts                  # +renderPrefabSection com 3 cards
src/client/audio.ts                 # +playEnemyKill
src/client/styles/combat.css        # +crit 2x, +hitShake, +criticalPulse, +enemyDying
src/client/campaign/campaign-screen.ts  # +is-hit, +is-dying classes em events
src/client/styles.css               # @import prefab-cards.css
```

## 9. 🎯 O que falar na próxima conversa

**Opção curta (auditar e iterar — recomendado):**
> Lê `HANDOFF_2026-05-27_densidade-done.md`. Estado: Sprint γ + Densidade entregues, 1007 tests verde, deploy live em https://jsgame-drpe.onrender.com. Hit `/api/dm/ux-funnel?days=1` em prod (5min de uso pra ter dado) e me reporta `rolls_per_session`, `dm_callback_used`, `dm_used_backstory`, `time_to_first_roll_ms`. Decide com base nas métricas qual feature precisa iterar (prompt tunning, ajustes de regex detector, etc).

**Opção: polir features existentes (sem entregar novas):**
> Sprint γ + Densidade entregues. Sem novas features. Vamos polir: revisar UX do combate (F2) em prod, ajustar verbos do enrichAttackLog se sentir repetitivo, tunar threshold da regex de skill-check-detector (γ.2) caso esteja triggering em falsos positivos. Roda 3 sessões de playtest e me lista atrito real.

**Opção: avançar pra próxima estratégia (não recomendado sem playtest):**
> Densidade entregue. Próxima etapa lógica: SSE streaming (δ.1 do STRATEGY_LISO_VICIANTE.md) ou onboarding inline tutorial (ε.3). Mas só faz sentido se métricas atuais já estiverem boas. Antes, valida com playtest qualitativo.
