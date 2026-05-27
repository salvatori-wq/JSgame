# JSgame · Estratégia "Liso, Polido & Gostoso de Jogar"

> **Filosofia**: polish > novas features. Cada elemento existente merece ser terminado — som, animação, feedback tátil, mobile-OK, copy clara. **Funcionalidades simples mas BONITAS e INTUITIVAS.** Quando o dado aparece, é chamativo. Quando NPC fala, é memorável. Quando combate começa, tem peso. **A IA é o coração** — rápida e confiável — mas é o polish geral que faz o player querer ficar.

> **Status**: Sprint α+β COMPLETO + **β.4 V2 mecânico** (action economy bloqueia 2 ações no mesmo turno). **877 tests verde**. Prod em commit `d8171c9`. Próximo: Sprint γ "POLISH FUNDAÇÃO".

---

## 1. Diagnóstico atualizado (pós β.4 V2)

Não falta feature. **Falta acabamento das que existem.**

### Atritos sensoriais
| Onde dói | Sintoma específico |
|---|---|
| **Dado é tímido** | Aparece só em skill check + save. Combate roll é texto puro "atacou 18 vs CA 13 = hit". Dano é número que aparece sem dramatização. d20 visual existe (`sc-die-rolling`) mas é 2D sem peso/sombra. Som único `playD20()` 0.18s — sem tap-tap-tap rolando, sem thud de aterragem, sem ting metálico no nat20. Sem haptic mobile. |
| **DM esquece de pedir rolls** | Apesar de α.1 + REGRA DE OURO no prompt, LLM ocasionalmente narra direto sem `request_skill_check`. Player passa 5 turnos sem rolar = sente que está "lendo livro". |
| **Latência DM 8-30s** | Player olha tela parada. Thinking indicator existe mas não convence "tá vindo". Provider serial (Cerebras → Gemini → Groq → Cloudflare) acumula falhas. |
| **Combate sem peso** | Click no inimigo → texto. Sem zoom-in no roll, sem screen shake em crit, sem floating damage com cor por tipo. |
| **Loot silencioso** | Item entra no inventário, toast tiny "+1 item". Sem TCG-card-reveal momento. Rarity glow já existe mas só dentro do modal. |

### Atritos de fluxo
| Onde dói | Sintoma específico |
|---|---|
| **First 5 minutos** | Wizard 5 passos antes de jogar. Anônimo desiste antes de ver narração. |
| **Onboarding cego** | Tutorial existe (cards) mas não inline. Primeira inspiração, primeiro crit, primeiro level up: sem dicas contextuais. |
| **Header mobile poluído** | 10+ botões (Sair, SFX, Music, Notifs, TTS, Memória, Difficulty, Quest, Achievements, NPCs, Share). Em 360px vira soup. |
| **Modais sem padrão** | Alguns têm swipe-down, outros não. Inconsistente. |

### Atritos técnicos
| Onde dói | Sintoma específico |
|---|---|
| **Cloudflare empty response** | Último provider sem fallback. Quando vazia, DM mostra "..." e usuário não sabe o que aconteceu. |
| **Echo player race** | "▶ Player: ação" às vezes aparece DEPOIS da narração da DM (race condition). Visual confuso. |
| **Sem telemetria UX real** | Não medimos `rolls_per_session`, `time_to_first_token_ms`, etc. Ganhos de futuro polish ficam intangíveis. |
| **Sem smoke test prod** | Bug catastrófico só descoberto quando user reporta. |
| **Zero retention loop** | Sessão acaba, nada chama amanhã. |

---

## 2. Princípios não-negociáveis

1. **Polish antes de feature nova**. 1 botão lindo > 5 botões mal-acabados.
2. **A IA é o coração que bate**: rápida (streaming), confiável (cascade 5+ providers), inteligente (forçar rolls).
3. **Reusar primitivas α+β, não recriar**. NarrationLog, modal-overlay, rarity glow, achievements counters, NPC roster, action economy V2 — tudo plantado.
4. **Cada interação memorável = visual + som + tátil**. Os 3 sentidos.
5. **Simples > complexo**. Cada commit ~300 LOC + tests. Refactor maior = adia.
6. **Mobile-first**: 360px é o spec, 414px é vantagem. Hit targets ≥38px.
7. **Zero budget + tests verde sempre**.

---

## 3. Plano — 4 Sprints temáticos (~46h total)

### 🔧 Sprint γ "POLISH FUNDAÇÃO" (~14h, recomendado primeiro)

**Objetivo**: corrigir bugs + dado chamativo + DM força rolls + mobile decente + telemetria pra MEDIR ganhos futuros.

---

#### γ.1 — Dado chamativo (4h) [DESTAQUE]

**Antes/depois**:
- HOJE: skill-check overlay com d20 2D girando, som `playD20()` 0.18s, verdict text. Combate é texto puro.
- DEPOIS: dado em 3D-ish CSS com sombra projetada, som em 3 camadas durante roll, haptic mobile no resultado, **dado aparece TAMBÉM em combate antes do hit/miss text**, crit dispara screen flash.

**Arquivos**:
- `src/client/dice/dice-3d.ts` (NOVO ~150 LOC) — encapsula o componente Dado reusável (`renderDie({ kind: 'd20'|'d6'|'d8', value, special?: 'crit'|'fumble' })`). Caller passa onComplete callback.
- `src/client/dice/dice-roll-overlay.ts` (NOVO ~80 LOC) — wrapper modal genérico que mostra dado + verdict pra rolls de combate (não só skill check). Reusável de skill-check-overlay.
- `src/client/audio.ts` — adiciona `playDiceRolling()` (loop sutil 600ms), `playDiceLand()` (thud 180Hz), `playDiceCritTing()` (chime ascendente — separar do playCrit). Existente: `playD20`, `playCrit`.
- `src/client/haptic.ts` (NOVO ~30 LOC) — wrapper sobre `navigator.vibrate` com gracioso degrade. Helpers: `hapticTap()` (50ms), `hapticCrit()` (3 pulses), `hapticFumble()` (1 long 300ms).
- `src/client/styles/dice.css` (NOVO ~120 LOC) — `.die-3d`, `.die-face`, `.die-shadow`, keyframes `dieRolling` (rotateY+X+Z combo), `dieCritFlash` (border-glow gold), `dieFumbleShake`.
- `src/client/combat/combat-screen.ts` — antes de emit `combatAction({attack})`, abre `diceRollOverlay({kind:'d20', preview: 'd20+5 vs CA 13'})`. Aguarda result do server (já vem via combatEvent), passa final pra overlay revelar.
- `src/client/campaign/skill-check-overlay.ts` — substitui `sc-die-idle/rolling/etc` por `<DieComponent>` reusável de `dice-3d.ts`. Behavior idêntico, visual upgrade.
- `src/server/combat.ts` — emit `combatEvent { type: 'attack-roll', value, crit, nat1 }` ANTES do `damage` event. Cliente usa pra animar dado antes de revelar dano.
- `src/shared/types.ts` — adiciona `'attack-roll'` ao `CombatEvent.type` union.

**Sound design specs**:
- `playDiceRolling()`: 3 bursts de `noise({duration: 0.04, bandpass: {freq: 2400, q: 4}})` espaçados 80ms, repetindo por 600ms, com gain envelope que acelera (40ms intervals nos últimos 200ms)
- `playDiceLand()`: `tone({freq: 180, freqEnd: 60, duration: 0.18, type: 'sawtooth', gain: 0.45})` + `noise({duration: 0.05, gain: 0.2, bandpass: {freq: 400, q: 1.5}})` em paralelo
- `playDiceCritTing()`: arpeggio descendente do `playD20` invertido — `tone(880→1320→1760, triangle, gain 0.4, 80ms cada)`
- Nat1 thunk: `tone({freq: 80, freqEnd: 30, duration: 0.4, type: 'sine', gain: 0.5})` + `noise({duration: 0.15, gain: 0.3, bandpass: {freq: 200, q: 1}})`

**Animation curves**:
- `dieRolling`: keyframes `{ 0%: rotateX(0) rotateY(0) rotateZ(0), 50%: rotateX(540deg) rotateY(720deg) rotateZ(180deg), 100%: rotateX(360deg) rotateY(360deg) rotateZ(0) }` em `cubic-bezier(0.34, 1.56, 0.64, 1)` durante 1100ms — overshoot bezier dá "vida" tipo dado físico
- `dieCritFlash`: `box-shadow: 0 0 30px gold` pulsing 3x em 800ms
- `dieFumbleShake`: `translateX(-3px → 3px)` 5x em 400ms + `filter: hue-rotate(45deg)` (faz dado ficar mais vermelho)

**Haptic specs (mobile)**:
- Roll start: `navigator.vibrate(20)` (feedback de "começou")
- Result reveal nat 1: `navigator.vibrate(300)` (long buzz)
- Result reveal nat 20: `navigator.vibrate([80, 40, 80, 40, 80])` (3 pulses celebratórios)
- Result reveal success normal: `navigator.vibrate(40)` (tap leve)
- Result reveal fail normal: nada (poupa bateria)
- Wrap com `'vibrate' in navigator` check + try/catch

**Edge cases**:
- `prefers-reduced-motion`: anima 200ms em vez de 1100ms; sem screen shake; sem flash pulse (single solid)
- Audio muted (sfxEnabled=false): skip sons mas mantém visual + haptic
- Screen reader: ARIA label `<div role="alert" aria-live="polite">Você rolou 18 — sucesso</div>` no result
- Dado em combate quando atacante é INIMIGO: NÃO mostra overlay (player só vê resultado, não anima dado deles)
- Multi-attack stacks: cada attack tem própria overlay; queue se chegar simultâneo

**Tests TDD**:
- `renderDie` retorna HTMLElement com data-kind, data-value
- `playDiceRolling` toca por 600ms (mock AudioContext, verifica chamadas)
- `hapticTap` degrada gracefully sem `navigator.vibrate`
- CSS classes corretas pra crit/fumble (snapshot string)
- Overlay revela value após 1100ms (fake timers)
- Combat-event `attack-roll` emitido ANTES de `damage` (integration)

**Métrica de validação**: `time_to_first_dice_visible_ms` após combat action click <100ms.

---

#### γ.2 — DM força mais rolls (anti-cheese checker server) (2h)

**Antes/depois**:
- HOJE: REGRA DE OURO no prompt + α.1 chips com hint. Mesmo assim DM esquece — passa turnos sem skill check.
- DEPOIS: server-side regex match nas keywords da `action.details`. Se action implica check (investigar, persuadir, etc) e DM NÃO chamou `request_skill_check`, server injeta automaticamente PENDING check ANTES da narração.

**Pure function**:
```ts
// src/server/skill-check-detector.ts (NOVO ~80 LOC + 30 tests)
export interface DetectedSkillCheck {
  skill: SkillId;
  dc: number;
  reason: string;
}

export function detectImpliedSkillCheck(
  action: string,
  details: string | undefined,
): DetectedSkillCheck | null;
```

**Keywords table** (case-insensitive, regex word boundary):
| Pattern | Skill | DC | Razão exibida |
|---|---|---|---|
| `\b(investig|examin|procur|vasculh|busc|olh)` | investigacao | 12 | "Procurar pistas" |
| `\b(persuad|convenc|negoc|barganh)` | persuasao | 13 | "Convencer alguém" |
| `\b(intimid|amedront|ameaç)` | intimidacao | 13 | "Intimidar" |
| `\b(engan|min[ts]o|ilud|blefar)` | enganacao | 14 | "Enganar" |
| `\b(escut|ouv|not|percebe)` | percepcao | 12 | "Notar algo" |
| `\b(esgu|furtad|esconde|sorrateir|silenc)` | furtividade | 13 | "Mover sem ser visto" |
| `\b(escal|salt|balanc|trep|nada|arrast)` | atletismo | 12 | "Esforço físico" |
| `\b(equilibr|cambalh|acrob|cair)` | acrobacia | 12 | "Equilíbrio/agilidade" |
| `\b(lembr|conhec|estud)` (+ contexto lore) | historia | 14 | "Recordar lore" |
| `\b(curar|trat|medic|bandag)` | medicina | 12 | "Tratar ferimentos" |
| `\b(rast|caç|sobrevi|trilh)` | sobrevivencia | 13 | "Rastrear" |
| `\b(arrombar|pick|destranc|escapar)` | prestidigitacao | 14 | "Habilidade manual" |

**Hook em campaign.ts**:
```ts
async takeAction(playerId, action, details) {
  // β.1 conexão: detecta check antes da DM call
  const implied = detectImpliedSkillCheck(action, details);
  if (implied && !this.state.pendingCheck) {
    this.state.pendingCheck = {
      skill: implied.skill, dc: implied.dc,
      reason: implied.reason, playerId,
    };
    // Avisa client + para de chamar DM nessa ação
    return this.dummyDMResponse(`Pra ${implied.reason}: ${SKILLS[implied.skill].name} DC ${implied.dc} primeiro.`);
  }
  // ... fluxo normal
}
```

**Edge cases**:
- DM já chamou `request_skill_check` nessa ação → respeita DM, não injeta
- Ação vazia / só action (sem details) → não dispara
- Keyword negada ("NÃO investiga", "evita olhar") → não dispara (regex word-boundary + negation skip)
- Múltiplas keywords match → primeira (ordem de prioridade lista acima)
- Combat ativo → não dispara (já tem combatAction flow)
- Action de player com nat-1 fresco (deathSaveFailures recentes) → DM continua, sem injeção

**Métrica**: `rolls_per_session` de ~2 → >8.

**Tests**: +12 (cada keyword dispara skill correto, negation skip, action vazia ignora, DM explícito vence injection, combat skip).

---

#### γ.3 — Echo player race fix (1h)

**Causa**:
HOJE em `connection.ts socket.on('takeAction')`:
1. emit `dmThinking` → cliente mostra "..."
2. `await camp.takeAction(...)` (lento, 8-30s LLM call)
3. emit `dmNarration` com narração
4. emit `dmNarration` com echo "▶ Player: action"

Order errado: echo deveria vir ANTES do thinking, não no fim.

**Fix**:
```ts
socket.on('takeAction', async ({ action, details }) => {
  // 1. Echo IMEDIATO antes de qualquer await
  io.to(camp.state.id).emit('dmNarration', {
    text: details || `${action}`,
    speaker: `▶ ${myName}`,
    mood: 'neutral',
  });
  // 2. Depois sim DM thinking + narrate
  await withThinkingBroadcast(...);
});
```

**Edge case**: client `suppressNextPlayerEcho` (auto-retry silent) ainda funciona — server emite, client suprime se precisar.

**Tests**: 1 integration test verifica order via timing assertion.

---

#### γ.4 — Cloudflare empty response fallback (1h)

**Causa**: CF Llama 3.3 70B ocasionalmente retorna text="" + toolCalls=[]. Hoje throw → cascade fallback → mas CF é último, sem fallback.

**Opção A: Mistral free tier (recomendado)**
- Endpoint: `https://api.mistral.ai/v1/chat/completions`
- Model: `mistral-small-latest` (gratuito, 1 req/s rate limit)
- API key: `MISTRAL_API_KEY` env var (config Render manual)
- Implementação: `src/server/dm/providers/mistral.ts` (novo ~120 LOC, segue padrão Cerebras/Groq)
- Adicionar no `cascade.ts` como 5º provider (após Cloudflare)

**Opção B: Degraded narration template (sem custo, sem env var)**
- Quando CF retorna vazia, server gera narração baseada em playerAction com regex:
  - "explorar" → "Você anda pela área. Tudo parece quieto demais — algo está observando."
  - "atacar" → "Você ataca! O combate começa."
  - etc
- Fallback automático sem dependência externa

**Recomendação**: Implementar AMBAS. Mistral primeiro, degraded como rede final.

**Tests**: +5 (cascade dispara Mistral; cascade dispara degraded; degraded template por action).

---

#### γ.5 — Mobile audit + header reorganização (3h)

**Audit checklist** (cada modal aberto em viewport 360px e 414px):
- [ ] Skill-check overlay: botão Inspiração não overflow
- [ ] Combat-screen action economy badge: vira 2 linhas em vez de 1 (já tem? verificar)
- [ ] Shop modal: grid auto-fit 240px vira 1-col em 360px sem ficar feio
- [ ] Achievements modal: 5 abas viram scroll horizontal com momentum
- [ ] NPC roster modal: cards 250px viram 1-col
- [ ] Inventory modal: cards 200px → 1-col com gold visible
- [ ] Quest log modal: scroll long ok
- [ ] Counterspell prompt: 5s timer visível sem overflow

**Header reorganização**:
- HOJE 10+ botões: Sair · SFX · Music · Notifs · TTS · Memória · Difficulty · Quest · Achievements · NPCs · Share
- DEPOIS 5 visíveis: Sair · Quest · Achievements · NPCs · Share
- Resto vai pra menu "⋯" (Sound settings, Persona settings, Memória, Difficulty)

**Padronização**:
- TODOS modais ganham swipe-down fechamento (já tem em alguns)
- TODOS modais respeitam `prefers-reduced-motion` (anima 200ms vs 600ms)
- Hit targets ≥ 38×38px em mobile
- Z-index hierarchy documentada (overlay 9400, modal 9500, picker 9700, toast 9999)

**Arquivos**:
- `src/client/util.ts` — `onSwipeDown` helper já existe, padroniza em todos modals
- `src/client/campaign/campaign-screen.ts` — header settings menu
- `src/client/styles/responsive.css` — adicionar `@media (max-width: 480px)` rules

**Tests**: snapshot CSS strings em viewport widths críticos.

---

#### γ.6 — Telemetria UX baseline (1h)

**Métricas novas em `metrics_events`**:
| Métrica | Quando | Por que |
|---|---|---|
| `time_to_first_narration_ms` | session start → primeira dmNarration | Velocidade percebida do coração |
| `time_to_first_roll_ms` | session start → primeiro diceRollResult | Quando jogador finalmente rola dado |
| `time_to_first_token_ms` | dm.thinking → primeiro chunk SSE (pós δ) | Streaming working? |
| `rolls_per_session` | session end (lifecycle event) | Quantos dados o player tira |
| `session_duration_ms` | session end | Engagement |
| `bounce_on_wizard_step` | wizard step change → abandon (sem completar) | Onde first-time desiste |
| `dm_silence_seconds_per_session` | sum of (gap entre player action → narration) | Quanto tempo player ficou esperando |
| `combat_actions_blocked_by_economy` | β.4 V2 retorna ok:false | Player tenta multi-action (educativo) |

**Endpoint novo**:
```
GET /api/dm/ux-funnel?days=7
{
  sessions: { total: N, completed: M, abandoned: O },
  conversion: { wizardStart: A, wizardComplete: B, firstAction: C, firstRoll: D },
  latency: { p50, p90, p99 of time_to_first_token_ms },
  rolls: { avg, median, max per session },
  blocked: { count of action_economy_blocked },
}
```

**Por que importa**: Sem isso, ganhos de Sprint δ/ε/ζ ficam intangíveis. "Ficou melhor" é subjetivo. Telemetria mede.

**Tests**: +3 endpoint shape + computation correctness.

---

**Deploy γ → prod via Chrome MCP**. Tests-alvo: 877 → ~925. Métrica-chave: `rolls_per_session` >8.

---

### ❤️ Sprint δ "CORAÇÃO RÁPIDO" (~10h)

**Objetivo**: player percebe DM começando a responder em <1s. Mesmo CF 30s sente que algo está acontecendo.

---

#### δ.1 — Server-Sent Events real streaming (4h)

**Antes/depois**:
- HOJE: client typewriter FAKE (texto chega completo após 8-30s, animação imita streaming)
- DEPOIS: server emite tokens conforme LLM gera → player vê palavras aparecendo em tempo real

**Implementation**:
- Server: socket emit `dmNarrationChunk { sessionId, chunkText, isFinal }`
- Cerebras streaming API: `stream: true` no request, lê chunks via `for await`
- Gemini: `generateContentStream`
- Groq: `stream: true`
- Cloudflare: `stream: true` (suportado em Workers AI)
- NarrationLog ganha `appendChunk(text, isFinal)` que acumula até `isFinal=true`, então finaliza animação
- Cancel: se nova ação vem mid-stream, server abort + cleanup

**Tests**:
- Chunk buffer parse (3 chunks → 1 narration completa)
- Mid-stream cancel cleanup
- Recovery de chunk perdido (timeout 5s sem chunk → assume fim)
- Provider sem streaming (fallback) → manda 1 chunk com `isFinal=true`

**Métrica**: `time_to_first_token_ms` ~8000 → <800.

---

#### δ.2 — Provider tuning paralelo (2h)

**HOJE**: serial `Cerebras → Gemini → Groq → Cloudflare`. Falha = next.

**DEPOIS**:
- Tier 1 (rápidos): Cerebras + Groq em PARALELO (Promise.race). Primeiro a responder ganha, cancela outro.
- Tier 2 (médios): Gemini se Tier 1 falhar
- Tier 3 (lento mas estável): Cloudflare
- Tier 4 (último): Mistral (γ.4)

**Timeouts**:
- Cerebras: 1.5s (rápido)
- Groq: 4s
- Gemini: 6s
- Cloudflare: 30s
- Mistral: 8s

**Risco**: dobra request count em tier 1. Free tiers aguentam (Cerebras 30/min, Groq 30/min).

**Tests**: race winner, cancel loser, cascade tier 1→2→3, all fail → degraded.

---

#### δ.3 — Predictive chips fallback (2h)

**Enquanto DM responde**, mostra 3 chips genéricos baseados em `currentLocation`:

```ts
// src/server/predictive-chips.ts (NOVO)
export function predictChipsForLocation(
  location: string,
  lastAction?: string,
): SuggestedAction[];
```

**Templates por contexto**:
- Taverna/inn/bar: "Pedir bebida" / "Ouvir conversas" / "Procurar trabalho"
- Masmorra/caverna/ruína: "Avançar cauteloso" / "Procurar armadilhas" / "Voltar"
- Cidade/vila/mercado: "Visitar mercador" / "Falar com guarda" / "Procurar rumores"
- Floresta/estrada: "Buscar trilha" / "Procurar abrigo" / "Acampar"
- Combate: usa combat actions já existentes
- Genérico: "Investigar" / "Falar com alguém" / "Continuar"

Se DM responder com `suggest_actions`, sobrescreve. Se esquecer, fallback fica.

**Tests**: +8 (cada location template, fallback genérico, lastAction context).

---

#### δ.4 — Optimistic echo (1h)

Player clica → echo INSTANTÂNEO no log (antes de socket.emit). Server NÃO emite echo (suppressNextPlayerEcho já existe). Se server rejeitar, retira com fade.

Latência percebida 200-500ms → 0ms.

**Edge case**: rejection (mutex coop) → echo gets `.is-rejected` class, fade out 400ms, removed.

---

#### δ.5 — Smoke test E2E prod (1h)

Script `scripts/smoke-prod.ts` roda 5 cenários completos em prod:
1. POST /api/characters (create PJ)
2. Connect socket, joinCampaign
3. Wait dmNarration (timeout 15s)
4. Emit takeAction `explore`
5. Wait dmNarration + verify pendingCheck if exists
6. Emit takeAction `attack`
7. Wait combatState
8. Force win, verify XP

Exit code 1 = falha. CronCreate roda diariamente. Alerta via webhook se quebra.

**Deploy δ → prod**. Métrica: `time_to_first_token_ms` ~8000 → <800.

---

### ✨ Sprint ε "PRIMEIRO CONTATO" (~12h)

**Objetivo**: novo player joga 1 sessão completa sem confusão. Loot + level-up dão dopamina TCG.

---

#### ε.1 — Quick-Start 3 PJs pré-fab (3h)

**Cards no home substituem wizard como FIRST PATH**:
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🪨 Borin         │  │ 🌟 Lyra          │  │ 🗡 Sina          │
│ Anão Guerreiro   │  │ Elfa Maga        │  │ Halfling Ladina  │
│ Soldado          │  │ Sábia            │  │ Charlatã         │
│ "Bate forte,     │  │ "Sabe magias e   │  │ "Rápida, sneaky  │
│  segura porrada" │  │  segredos"       │  │  precisa, tátil" │
│                  │  │                  │  │                  │
│ [JOGAR ⚔]        │  │ [JOGAR 🔮]       │  │ [JOGAR 🗡]       │
└──────────────────┘  └──────────────────┘  └──────────────────┘

Quer personalizar? [Wizard customizado →]
```

**Pré-fab specs**:
- Borin: anão-da-montanha guerreiro nv1 (FOR 16/DES 12/CON 15/INT 8/SAB 12/CAR 10), Soldado, atletismo + intimidação, equipped: machado dois-gumes + escudo
- Lyra: alta-elfa maga nv1 (FOR 8/DES 14/CON 12/INT 16/SAB 13/CAR 10), Sábia, arcanismo + história, equipped: cajado, spells: misseis-magicos + escudo-arcano
- Sina: halfling ladina nv1 (FOR 8/DES 16/CON 12/INT 13/SAB 12/CAR 14), Charlatã, furtividade + enganação + prestidigitação, equipped: adagas duplas

**Arquivos**:
- `src/dnd/prefab-characters.ts` (NOVO ~150 LOC) — define os 3 PJs como factories
- `src/client/home/home-screen.ts` — cards visíveis quando user é first-time (sem PJs)
- `src/client/styles/home-core.css` — cards CSS

**Conversão first-run alvo**: ~30% → ~70%.

---

#### ε.2 — Loot Screen pós-combate TCG (2h)

**Hoje**: combate acaba → toast `+100 XP` → silêncio.

**Depois**: overlay full-screen 3.5s:
```
╔══════════════════════════╗
║      ⚔  VITÓRIA  ⚔       ║
╠══════════════════════════╣
║                          ║
║      +127 XP             ║   ← counter anim 0→127 em 1s
║                          ║
║  ┌──────────────┐        ║   ← Card 1 com glow rarity
║  │ 🗡 Espada +1 │ RARO   ║
║  │ (azul glow)  │        ║
║  └──────────────┘        ║
║  ┌──────────────┐        ║
║  │ 🧪 Cura      │ INCOMUM║
║  │ (verde glow) │        ║
║  └──────────────┘        ║
║                          ║
║       [Continuar]        ║
╚══════════════════════════╝
```

**Anim sequence**:
1. Overlay fade-in 200ms
2. "VITÓRIA" text bounce-in
3. XP counter anim 0 → final em 1s (easing easeOutCubic)
4. Items append 1-a-1 com 200ms delay, loot-burst (reusa α.2 animation)
5. Items raros+ tocam `playDiceCritTing()` no append
6. Auto-dismiss após 3.5s OR button click

**Arquivos**:
- `src/client/combat/loot-screen.ts` (NOVO ~120 LOC) — `openLootScreen({xp, items, onClose})`
- `src/client/styles/loot-screen.css` (NOVO ~80 LOC)
- `src/client/campaign/campaign-screen.ts` — hook em combatEvent `'victory'`

**Tests**: pure helpers (formatXpDisplay, sortItemsByRarity), animation timing snapshot.

---

#### ε.3 — Tutorial inline first-time (2h)

**Hoje**: tutorial atual é cards estáticos no início. Player primeiro turno em combate olha pra tela e não sabe o que é "HP" "AC" "Iniciativa".

**Depois**: tooltips flutuantes em PRIMEIRA aparição de cada elemento. localStorage flag por id.

**Tooltips list**:
| Trigger (primeira vez) | Tooltip text | Posição |
|---|---|---|
| Primeiro skill check overlay aberto | "Esse é o d20! Modifier + bônus de proficiência. DC = dificuldade. Bom rolling!" | Acima do dado |
| Primeiro combate iniciado | "Combate! HP é tua vida (em vermelho). AC é tua defesa. Iniciativa decide ordem. Clica no inimigo pra atacar." | Centro top |
| Primeiro nat20 | "✨ NAT 20 — sucesso espetacular! Dado em D&D é puro caos." | Centro |
| Primeira inspiração ganha | "🌟 Inspiração! Antes de rolar skill check, clica no botão dourado pra ganhar advantage." | Próximo ao badge |
| Primeira loot rarity ≥ raro | "💎 Item raro! Olha o glow azul. Cuidado com lendários (laranja) — game-changers." | Próximo ao card |
| Primeiro level up | "🌟 LEVEL UP! Ganhou HP, talvez novo slot de magia ou feature. Verifica a ficha." | Centro |
| Primeira ação bônus bloqueada (β.4 V2) | "⛔ Já gastou Ação Bônus neste turno. PHB pág 189 — economia de ações." | Próximo ao botão |

**Arquivos**:
- `src/client/onboarding/inline-tutorial.ts` (NOVO ~150 LOC) — `showTooltip({trigger, text, anchor, oncePerUser?: true})`
- `src/client/styles/inline-tutorial.css` (NOVO ~60 LOC) — pointer arrow + bg blur + fade

**Tests**: storage gating (não mostra 2x), positioning calculated.

---

#### ε.4 — Audio mood adaptativo refino (1h)

**Hoje**: F21 ambient music existe (combat / exploration). Falta granularidade.

**Depois**:
- Música por TIPO de local detectado em `currentLocation`:
  - `/taverna|inn|bar/i` → calmo, viola plucks (já tem? confirmar)
  - `/masmorra|caverna|ruín/i` → drone tenso, bass low rumble
  - `/cidade|vila|mercado/i` → festivo, com voices ambient
  - `/floresta|estrada|deserto/i` → vento + leaves
- Transição combat → exploration: fade 1.5s (não cut)
- Level up: arpeggio expandido (4 → 7 notes, mais épico)

**Arquivos**:
- `src/client/audio.ts` — `setAmbient(mood)` ganha sub-categorias

---

#### ε.5 — Header mobile fix (γ.5 audit → ε.5 implementa) (1h)

Já especificado em γ.5. Aqui executa as mudanças efetivas.

---

#### ε.6 — Achievement unlock animation polish (1h)

**Hoje**: toast simples.

**Depois**:
- Burst sparkles CSS (6 elementos rotacionando, fade-out 1s)
- Tier visual: bronze chime curto, prata mid, ouro fanfare, platina confetti CSS
- Sound específico por tier (existe? reforçar)

**Arquivos**:
- `src/client/achievements-toast.ts` — extend com tier param

---

#### ε.7 — Color tokens + WCAG contraste audit (1h)

- Audit `_tokens.css`: contraste AA em todos pares
- `--ink-mute` parece ilegível em alguns lugares → bumpa luminance
- Rarity-* texto sempre legível em background dark
- Documenta as combinações aprovadas em comments

---

#### ε.8 — Save indicator visual (1h)

Badge "✓ Salvo às 14:32" canto sup-direito 2s após cada save. Confiança visual. CSS leve, JS ~20 LOC.

**Deploy ε → prod**. Métrica: `first_session_completion_rate` ~30% → >70%.

---

### 🔁 Sprint ζ "VOLTA AMANHÃ" (~10h)

**Objetivo**: 3 razões claras pra player voltar amanhã. Cada sessão N+1 mais profunda.

---

#### ζ.1 — Daily Challenges (3h)

5 challenges rotativos. Reusa α+β counters:

| Challenge | Detecção | Reward |
|---|---|---|
| "Ganha 1 inspiração" | `grant_inspiration` event count >= 1 hoje | +50 XP |
| "Conjure 3 magias" | `spells_cast_today` >= 3 | +50 XP + 1 inspiração |
| "Visite local novo" | `unique_locations_today` >= 1 | +30 XP |
| "Vença combate sem dano" | `combat_won` + `damage_taken_this_combat=0` | +100 XP + título "Imaculado" |
| "Persuade NPC hostil" | β.1 NPC `relationship` mudou de <0 pra >0 | +75 XP |

**Schema**: tabela `daily_challenges(date, user_id, challenge_id, completed_at)`. Rotation determinística por date hash.

**UI**: badge header "🎯 3/5 desafios" + modal com lista + progress.

---

#### ζ.2 — Meta-progressão "Almas" (3h)

User logado ganha **alma** em eventos especiais:
- PJ morre permanentemente (3 death-save failures): 1 alma
- Termina sessão 5 da campanha: 3 almas
- Mata boss: 1 alma
- Unlock achievement gold/platinum: 1 alma

Almas desbloqueiam (consume-on-unlock):
- 5 → DM personality nova "místico" (Tarot/Hermes vibes)
- 10 → raça secreta drow ou tiefling fire-blood
- 15 → classe secreta artificer
- 25 → New Game+ mode (PJ começa nv 5, ambient permanent dark)

**Schema**: reusa `achievements_counters` (key `souls_total`). Unlocks salvas em `user_meta_unlocks(user_id, unlock_id, unlocked_at)`.

**UI**: novo modal "💀 Almas" header. Mostra current total + lista de unlocks (locked/unlocked com tier visual).

---

#### ζ.3 — Hall of Fame compartilhável (2h)

Reusa highlights de F20:
- Modal "🌟 Salão da Fama" header (user logado)
- Top 5 highlights de TODAS as campanhas do user (sorted by importance)
- Export como imagem (canvas render): PJ portrait + quote + data + jsgame logo
- Share button → copy public link `/h/:slug`
- Public page `/h/:slug` standalone (sem login required, SEO-friendly)

**Schema**: tabela `public_highlights(slug, payload_json, created_at)` — slug é 8 chars random.

---

#### ζ.4 — Weekly leaderboard (1h)

Tabela `weekly_scores(week_start, user_id, kills, xp, sessions)`. Header mostra rank semanal do user. Modal top 10. Reset toda segunda 00:00 UTC.

**Privacy**: opt-in. User pode marcar perfil como privado.

---

#### ζ.5 — Surprise mechanics (1h)

Cada um pequeno mas impactante:
- **1% chance loot lendário em ANY combat** (não só boss) — server roll após victory
- **0.5% chance NPC mítico aparece** durante exploration — server inject `npc_speaks` tool com NPC especial
- **Easter egg "Lucky Dice"**: 3 nat20 seguidos = avatar player ganha border dourada permanente em party panel (CSS class via achievement)
- **Título "Imaculado"** visível no party panel se boss-kill + 0 dano party
- **Combo crit chain SFX**: crit consecutivo (já tem `notifyCrit`) escala áudio (2º = louder, 3º = epic)

**Deploy ζ → prod**. Métrica: `D1_retention` >40%.

---

## 4. Cronograma

```
Dia 1 (14h)  →  Sprint γ "POLISH FUNDAÇÃO"      6 commits, deploy
Dia 2 (10h)  →  Sprint δ "CORAÇÃO RÁPIDO"       5 commits, deploy
Dia 3 (12h)  →  Sprint ε "PRIMEIRO CONTATO"     8 commits, deploy
Dia 4 (10h)  →  Sprint ζ "VOLTA AMANHÃ"         5 commits, deploy

Total: 46h, 24 commits, 4 deploys
```

Todos executáveis autônomos. Zero budget. Tests verde sempre.

---

## 5. Métricas-alvo (telemetria de γ.6 mede tudo)

| Métrica | Hoje | Pós-γ | Pós-δ | Pós-ε | Pós-ζ |
|---|---|---|---|---|---|
| `rolls_per_session` | ~2 | **>8** | >8 | >10 | >12 |
| `time_to_first_token_ms` | ~8000 | ~8000 | **<800** | <800 | <800 |
| `first_session_completion_rate` | ~30% | ~40% | ~50% | **>70%** | >70% |
| `dm_silence_seconds_per_session` | ~120 | ~100 | **<30** | <30 | <30 |
| `D1_retention` | ? | — | — | — | **>40%** |
| `achievements_unlocked_per_session` | ~0.5 | ~0.5 | ~0.5 | ~1 | **>2** |
| `combat_actions_blocked_by_economy` | 0 | tracked | tracked | tracked | tracked |

---

## 6. Como cada sprint reusa α+β (já feito)

| α+β | Polish em γδεζ |
|---|---|
| α.1 chips | δ.3 fallback predictive usa mesma UI; γ.2 anti-cheese complementa |
| α.2 rarity | ε.2 loot screen TCG card-reveal usa glow; ζ.5 lendário 1% |
| α.3 inspirações | γ.1 dado chamativo no overlay; ε.3 tutorial first-inspiração; ζ.1 daily challenge |
| α.4 voice | δ.1 streaming TTS chunk paralelo |
| β.1 NPC roster | ζ.3 Hall of Fame top NPCs; γ.5 mobile audit roster modal; ζ.1 challenge "persuadir hostil" |
| β.2 achievements | ζ.1 daily counters; ζ.2 almas tier-based; ε.6 unlock burst polish |
| β.3 vendor | ζ.2 almas currency adicional; ε.2 loot screen preço estimado |
| β.4 V2 economy | ε.3 tutorial first-bonus-blocked; γ.6 telemetria counts blocked attempts |

**Nada se refaz. Tudo se polish.**

---

## 7. Princípio guia

> "Não falta feature. Falta cada elemento que existe HOJE merecer terminar de ser feito. Polish > complexidade. Cada interação memorável precisa de coreografia de 3 sentidos — visual + som + tátil. A IA é o coração, e o resto do corpo precisa estar lindo pra alguém querer ficar."

**Por isso a ordem**: γ (corrigir + dado bonito + medir) → δ (IA pulsa rápido) → ε (intuitivo + dopamina) → ζ (motivação amanhã).
