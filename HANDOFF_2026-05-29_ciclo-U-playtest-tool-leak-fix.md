# Handoff — Ciclo U (playtest + tool leak fix) + roadmap revisado

> **Data**: 2026-05-29 · **1 commit fix + docs** · **1770→1794 tests verde (+24)** · **typecheck OK** · **working tree limpo após docs**

## 1. Por que esse ciclo é diferente

Depois de 8 ciclos de polish consecutivos (M+N+O+P+Q+R+S+T = 12 commits + 7 docs, +179 tests), parei pra perguntar **"vale a pena outro ciclo?"** João disse: critério de parada é "no mínimo BOM pra playtest, sem perder engajamento".

Plano original era Sprint F4 (combate D&D real, suposto buraco crítico do roadmap). Audit profundo do agent inferiu 3 buracos:
- Death Saves não rodam
- Saving throw sem UI em combat
- Spell resolver ausente

**Realidade descoberta**: TODOS JÁ ESTAVAM FECHADOS.
- `rest-handler.ts:113-176` death save PHB-correto + socket `rollDeathSave`
- `connection.ts:451` saving throw flow + `saving-throw-overlay.ts` (η.6)
- `spells-engine.ts` 404 linhas — damage/heal/condition/buff + concentration + upcasting

105 tests verde em combat/spells/saving-throw/rest-death/reactions/concentration/counterspell. **F4 entregue há vários ciclos, CLAUDE.md desatualizado dizendo "PRÓXIMA".**

## 2. Playtest headless real

Spawnei preview, set localStorage (owner + skip tutorials), cliquei prefab Lyra (mago alta-elfa, valida spell flow).

**Cold-open**: "Cela úmida da fortaleza" — pergaminho rúnico, carcereiro intimidador. Skill check Arcanismo DC 13 disparou via tool. Status ribbon mostrou HP 7/7, slots 2/2.

**Click "⚔ Combate" (direct-action)**: deveria iniciar combate. Mestre retornou narração legítima até a vírgula, depois cuspiu literal:

> `"...Então é assim, elfa? Sem conversa?"+ tool start_combat (enemies: [{name: "Carcereiro Bruto", hp: 11, ac: 13, initiativebonus: 0}])+ tool suggest_actions (actions: [{label: "Atacar Carcereiro"...}])`

**Player vê isso**. Combate não iniciou (tool não foi parseada). Echo do player apareceu como "attack" literal.

**Causa**: cascade Groq deu 429 (rate limit), failover Gemini retornou narração vazia + toolCalls (mode=auto bug conhecido), retry-sem-tools foi disparado. Gemini sem tools imitou exemplos do system prompt (prompts.ts:275-281) que mostram literal `+ tool start_combat (enemies: [...])`.

**Logs servidor**:
```
[cascade] groq falhou (429) — failover pra gemini
[cascade] gemini respondeu após 1 provider(s) falharem
[dm] narração vazia com toolCalls — retry sem tools
[cascade] groq falhou (429) — failover pra gemini
[cascade] gemini respondeu após 1 provider(s) falharem
```

## 3. Fix Ciclo U (`a71e3b6`)

### U.1 — `stripInlineToolMentions(text)` em `dm.ts`

Pattern defensivo `\s*\+?\s*tool\s+(KNOWN_NAMES)\s*\(` (case-insensitive),
trunca a partir do primeiro match.

`KNOWN_TOOL_NAMES`: 24 tools de prompts.ts + variações compactas
(Gemini às vezes vira "startcombat" sem underscore).

Aplicado em ambos caminhos extractJson (linha 146 inicial + 157 retry).

`isLeakedToolCallJson` (já existia) cobre JSON puro/```json```; agora
`stripInlineToolMentions` cobre formato Markdown-ish inline.

12 tests:
- Format real do playtest "+ tool start_combat (enemies: [{...}])"
- Versão compacta sem underscore "startcombat"
- Multi-tool inline em sequência
- Case insensitive ("+ Tool Apply_Damage")
- Sem o sinal "+" (defensivo)
- Non-regressão: "toolkit"/"tool antiga" como palavras legítimas
- Cobre 5 tools diferentes (suggest_actions, apply_condition, end_combat,
  describe_scene, enemy_casts_spell)

### U.2 — `explorationActionLabel(action)` em `connection.ts`

Mapeia 10 ExplorationAction (types.ts:622) pra label PT-BR com ícone:
- attack → "⚔ Atacar"
- explore → "🔍 Explorar"
- investigate → "🔎 Investigar"
- sneak → "🥷 Furtar-se"
- travel → "🚶 Viajar"
- talk → "🗣 Falar"
- rest-short → "🛌 Descanso Curto"
- rest-long → "🏕 Descanso Longo"
- use-item → "🧪 Usar Item"
- cast-spell → "🔮 Lançar Magia"

Fallback raw se action desconhecida (defensivo, não quebra).
Usado em takeAction handler:

```ts
const actionLabel = explorationActionLabel(String(action));
const echoText = details ? `${actionLabel} — "${details}"` : actionLabel;
```

12 tests: 1 por action + fallback + cobertura total.

## 4. Push pro Render

Antes do Ciclo U, fiz **`git push origin main`** com **21 commits** acumulados desde antes do Ciclo M (todo o polish M+N+O+P+Q+R+S+T + Groq cascade reorder). Render auto-deploy disparou.

Após Ciclo U, mais 1 commit pendente (`a71e3b6`) + 1 docs (este). Recomendação: push final pra fechar.

## 5. Roadmap revisado

| Feature | Estado real |
|---|---|
| **F1** Foundation | ✅ |
| **F2** Wizard de PJ | ✅ (8 steps — race/class/subclass/abilities/background/personality/feat/review) |
| **F3** Mestre IA + Exploração | ✅ (cascade groq→gemini, RAG, persona) |
| **F4** Combate D&D real | ✅ **ENTREGUE** (105 tests). Inclui F25 concentration, F26 damage profile, F27 saving throws, α.3 inspiration, β.7 end-turn, reactions (counterspell/OA/shield), spell engine, death saves end-to-end |
| **F5** Polish + Coop + Magias + Rest + PWA | ✅ Coop, magic items, short rest visual (T2.5), long rest ritual (T3.3), achievements, tombstones, streaks. **Falta**: PWA install banner refino |

## 6. Aprendizados Ciclo U (importantes pra próxima sessão)

1. **Playtest headless > audit estática.** Agente audit inferiu 3 buracos críticos
   que JÁ ESTAVAM FECHADOS. Playtest real (15min, 6 LLM calls) revelou 2 bugs
   reais que NENHUM audit pegou.

2. **Início de sessão = playtest, não audit.** Tasks como "audit Home", "audit
   Wizard" inflaram 8 ciclos. Vale 1 playtest curto pra calibrar onde está o
   próximo gap real.

3. **CLAUDE.md desatualizado = perda de tempo.** Tava dizendo "F4 PRÓXIMA" há vários
   ciclos quando F4 estava feito. Próxima sessão começava planejando F4 = trabalho
   duplicado. **Status atual corrigido neste ciclo.**

4. **System prompt como vetor de leak.** Exemplos no system prompt podem ser
   imitados pelo LLM quando ele cai em modo degradado. Para qualquer formato
   "exemplo de uso", considerar marcar com delimitadores ou usar JSON em vez
   de texto livre.

5. **Push frequente** — main estava 21 commits atrás do origin. Polish entregue
   não estava em prod.

## 7. Estado final

```bash
$ git log --oneline | head -8
<docs>  docs(U): HANDOFF ciclo U + CLAUDE.md (F4 entregue + push docs)
a71e3b6 fix(U): tool call leak no narration + player echo PT-BR
7d2776b docs: HANDOFF ciclo T + CLAUDE.md atualizado
93b5b6e feat(T3): polish — ach hidden distinct + dice preview chips + long rest ritual visual
950e19b feat(T2): médio — sheet saves card + inv separator + ach anon banner + lobby preview + short rest visual
13216fb feat(T1): crítico — onboarding PT-BR + tour fold + email loading + ach empty + lobby status
8ab1647 docs: HANDOFF ciclo S + CLAUDE.md atualizado
2b4f336 feat(S3): polish — prefab uniforme + glossary empty CTA + quest empty hints + login loading
```

Tests: **1794 verde** · Typecheck: **OK** · Working tree: **limpo após docs**

Total da sessão (ciclos M+N+O+P+Q+R+S+T+U): **13 commits feature/fix + 9 docs**, 1591 → 1794 tests (+203).

## 8. Próxima sessão — comece pelo playtest

Antes de qualquer audit ou plano:
1. `git pull` + `npm test` (sanity)
2. `git log --oneline | head -10` (estado)
3. Abrir preview, prefab → combate → spell → tomar dano (15 min). Anotar gaps reais.
4. Se gap aparecer → fix. Se não → fechar ciclo e validar com playtest humano (você + 1 amigo no celular).

Áreas que poderiam render gaps em playtest mais longo:
- Combate via DM tool — disparado pelo Mestre via prompt, não testado em playtest deste ciclo
- Sessão coop (2 players) — não testado em playtest deste ciclo
- Death save real (chegar a HP 0 — não atingiu)
- Long rest ritual cinematic (T3.3) — não disparado
- Short rest picker (T2.5) — não disparado
- PWA install banner — não testado
