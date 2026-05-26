# JSgame — Handoff para execução autônoma das Rodadas 1+2+3

## 1. Estado atual

**2026-05-26.** Working tree limpo. Sessão atual fechou rodadas A+B+C (8 tasks, 7 commits novos). 414/414 tests verdes, typecheck limpo. 30 commits locais acumulados desde último deploy (`603e168` em prod). Pronto pra execução autônoma das próximas 3 rodadas.

## 2. O que foi feito nesta sessão

1. `5e2b9ea` — A2+B1 buff engine genérico (Bardic, Bless, Guidance, Shield, Faerie Fire) + smart enemy AI (boss scoring: low-HP, concentrating, casters, buffs).
2. `14c1409` — B3 encounter builder (DM tool `start_combat_balanced` com PHB DMG XP thresholds).
3. `9e009d9` — C3 voice TTS narrações DM via Web Speech API PT-BR (zero custo).
4. `d43e18d` — A1 coop reconnection (re-emit joinCampaign on reconnect) + race lobby UX (mostra quem falta) + spectator transcript ao vivo (skill check + save no log permanente).
5. `734c448` — B2 tutorial first-combat overlay (5 cards: Atacar/Esquivar/Habilidades/Especiais/Glossário).
6. `2b84498` — C1 mobile combat tabs/swipe (Inimigos/Ações/Log).
7. `d6d8b5a` — Handoff intermediário documentando A+B+C completos.

Tests cresceram 398 → 414 (+16: buff engine 8 + smart AI 3 + encounter builder 5).

## 3. Contexto técnico relevante

- **Plano executável já escrito**: `NEXT_ROUNDS_PLAN.md` na raiz tem cada sub-task detalhada com arquivos a tocar, critério de done, commit msg sugerida. Próxima sessão LÊ esse plano primeiro.
- **Memórias do projeto**: `MEMORY.md` (index) e `feedback_zero_budget.md` (regra inviolável). Sem novas memórias geradas nessa sessão — tudo já capturado no plano.
- **Padrões mantidos** (não rediscutir): DOM puro sem framework, sql.js, Gemini Flash default, validação server-side toda tool call, mobile-first, F28 inventory profundo VETADO.
- **i18n descartado** explicitamente — PT-BR único por enquanto.
- **Mobile is-portrait-narrow** fix aplicado em rodada anterior (avalia só `width < 600`, com listener resize). Não regredir.
- **Coop visibility** já fixado (echo takeAction + combatAction + chat livre + spectator transcript). Se aparecer regressão, ver `HANDOFF_2026-05-26_coop-visibility-fix.md`.

## 4. Padrão central reaproveitável

Buff engine pattern em `src/server/buff-engine.ts` — qualquer feature de spell/class que aplica modifier temporário deve seguir:

```ts
// 1. Definir factory:
export function makeMyBuff(): ActiveBuff {
  return {
    id: `mybuff-${Date.now()}`,
    source: 'My Buff Name',           // único pra dedup em re-cast
    appliesTo: 'attack' | 'save' | 'skill-check' | 'ac' | 'damage-roll',
    effect: { kind: 'dice-bonus', dice: '1d4' },  // ou flat-bonus / advantage
    charges: 1,                       // consome 1x ao usar
    // OU turnsLeft: 10,              // decrementa fim turno
  };
}

// 2. Aplicar via addBuff(target, makeMyBuff())

// 3. Hook no roll:
const buffs = consumeBuffs(target, 'attack');
const roll = rollD20({ modifier: base + buffs.flatBonus + buffs.diceBonus,
                       advantage: buffs.advantage });

// 4. AC bonus passive:
const ac = baseAc + readAcBonus(target).flatBonus;
```

Counterspell (rodada 2A) e Dispel Magic seguirão esse pattern via `consumeBuffs(target, 'all')` ou um remove explícito.

## 5. Follow-ups sugeridos

**Bloqueantes pré-execução** (precisa de João, não próxima sessão):

- [ ] **P1 — push prod** (`git push origin main`): 30 commits acumulados. Próxima sessão não pode validar deploy sem isso.
- [ ] **P2 — playtest E2E coop com amigo**: validar A1 reconnect + tutorial first-combat + mobile tabs no mundo real. Coleta bugs antes da Rodada 1.

**Rodadas autônomas** (próxima sessão executa em sequência):

- [ ] **Rodada 1 (~8h)**: 1A racial damage profile + 1B UI badges concentration/buffs + 1C DM personality presets (5 estilos).
- [ ] **Rodada 2 (~10h)**: 2A Counterspell/Dispel Magic + 2B refactor `index.ts` em routes/sockets.
- [ ] **Rodada 3 (~7h)**: 3A highlight reel HTML exportável + 3B player escolhe difficulty de combate.

**Apostas longas** (opcionais, fora do escopo das 3 rodadas):

- [ ] Persistent world cross-campaign (NPCs/locais voltam entre campanhas).
- [ ] Async/play-by-post mode (notif push entre turnos).
- [ ] Mod system / homebrew classes via JSON upload.

## 6. Arquivos-chave tocados

- `C:\Users\JOÃO\JSgame\NEXT_ROUNDS_PLAN.md` — plano executável das 3 rodadas (LER PRIMEIRO).
- `C:\Users\JOÃO\JSgame\src\server\buff-engine.ts` — engine de buffs com pattern reaproveitável.
- `C:\Users\JOÃO\JSgame\src\server\combat.ts` — smart AI scoring + integração buff engine.
- `C:\Users\JOÃO\JSgame\src\dnd\encounter-builder.ts` — PHB DMG XP thresholds.
- `C:\Users\JOÃO\JSgame\src\client\voice-tts.ts` — Web Speech API wrapper.
- `C:\Users\JOÃO\JSgame\src\client\combat\combat-tutorial.ts` — overlay 5-card first-combat.
- `C:\Users\JOÃO\JSgame\src\client\combat\combat-screen.ts` — mobile tabs/swipe.
- `C:\Users\JOÃO\JSgame\src\client\main.ts` — reconnect auto re-emit joinCampaign.
- `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-26_ABC-complete.md` — handoff anterior detalhado.

## 7. Deploy / ambiente

- **Último commit em prod**: `603e168` (F10 — Lobby pré-jogo, deploy antigo).
- **Commits locais acumulados**: 30 (incluindo F11-F35 + A+B+C + coop fixes + handoffs).
- **URL prod**: https://jsgame-drpe.onrender.com
- **Repo**: https://github.com/salvatori-wq/JSgame
- **Env vars críticas**: `GEMINI_API_KEY` (free tier 1500/dia). Setar no Render dashboard antes do push.
- **Render plan**: free tier — aguenta deploy automático em push.
- **Turso DB**: `jsgame-prod` em `aws-us-west-2` (free tier).

## 🎯 O que falar na próxima conversa

**Opção curta (executar autônomo conforme plano):**

> Lê `NEXT_ROUNDS_PLAN.md` na raiz e `HANDOFF_2026-05-26_autonomous-execution.md`. Executa autônomo as Rodadas 1+2+3 em sequência. Pré-rodadas P1 (git push) e P2 (playtest) são manuais do João — assume que ele faz em paralelo e não bloqueia. Stop em 80% janela contexto + handoff parcial. Confirma tests verdes a cada commit. Sem i18n, sem F28, zero-budget mantido.

**Opções específicas (se quiser só uma rodada):**

1. **Executar só Rodada 1 (UI badges + racial damage + DM personality):**
   > Lê `NEXT_ROUNDS_PLAN.md` seção "Rodada 1". Executa 1A → 1B → 1C em sequência. 3 commits esperados (~8h). Stop ao fim da rodada com handoff curto. Tests 414+ verdes a cada commit.

2. **Executar só Rodada 2 (Counterspell + refactor index.ts):**
   > Lê `NEXT_ROUNDS_PLAN.md` seção "Rodada 2". Executa 2A (Counterspell/Dispel) → 2B (refactor index.ts em routes/sockets). Critério done: `wc -l src/server/index.ts` ≤ 250 LOC. 5-7 commits.

3. **Executar só Rodada 3 (highlight reel + difficulty player):**
   > Lê `NEXT_ROUNDS_PLAN.md` seção "Rodada 3". Executa 3A (highlight HTML exportável) → 3B (player difficulty dropdown). 2 commits, ~7h.

4. **Validar deploy + smoke prod antes de qualquer rodada:**
   > Antes de tocar código, valida deploy em prod: `git push origin main`, aguarda Render build, `curl https://jsgame-drpe.onrender.com/api/health` retorna ok + gemini provider. Se quebrar, debug ENV vars no Render dashboard. Depois faz handoff curto pra próxima rodada.

5. **Investigar bug específico reportado pelo João:**
   > João reportou bug X em playtest E2E coop (cole detalhes aqui: console error + server log). Fix em até 30 min ou escreve handoff com bug aberto. Sem bug específico, ignora essa opção.

Começa com a Opção curta se quiser maratona autônoma das 3 rodadas. Se preferir foco numa rodada específica, vai direto numa das 1-3. Opção 4 é segurança pré-trabalho. Opção 5 só se aparecer regressão real.
