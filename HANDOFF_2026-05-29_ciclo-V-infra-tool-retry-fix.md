# Handoff — Ciclo V (infra deploy + tool retry + 4 micro-bugs)

> **Data**: 2026-05-29 · **1 commit fix + docs** · **1794→1802 tests verde (+8)** · **typecheck OK** · **working tree limpo após docs**

## 1. Por que esse ciclo existe

João reportou no fim de sessão: **"rodamos atualizações e não replicam no jogo. Não dá pra jogar dado. Algo está errado"**.

Diagnóstico revelou um problema infra crítico:
- **Origin/main**: `272d879` (sincronizado)
- **Render prod**: congelado em `d97c7ba` há **17h** (28/05 00:22 BRT)
- **41 commits NÃO deployados**: todo Sprint Φ + ciclos M+N+O+P+Q+R+S+T+U

Render auto-deploy parou silenciosamente. Joao fez **redeploy manual** em paralelo enquanto eu codifiquei fixes pra prevenir voltar.

Bonus: aproveitei pra fixar bugs descobertos no playtest da sessão anterior.

## 2. Commit (`72adbd0`)

3 áreas:

### V.1 — Infra (CRÍTICO prod)

**V.1.a — `render.yaml` removida `DM_PROVIDER=groq`**

```diff
-      - key: DM_PROVIDER
-        value: groq
+      # V.1 — DM_PROVIDER REMOVIDO (era 'groq' single-provider).
+      # Bug: em prod, força APENAS Groq sem cascade. Groq 429 = jogo trava
+      # sem fallback. Em dev, sem essa env, auto-detect cascade salvava.
+      - key: GEMINI_API_KEY
+        sync: false   # ESSENCIAL pra fallback. Cria conta em ai.google.dev
+      - key: CEREBRAS_API_KEY
+        sync: false   # OPCIONAL (Llama 3.3 70B, 1M tok/dia free)
+      - key: MISTRAL_API_KEY
+        sync: false   # OPCIONAL (Mistral Small, 500K/dia)
```

`factory.ts:65` checa `DM_PROVIDER` explícito ANTES do auto-detect cascade.
Quando setado, retorna provider single sem fallback. Em prod isso era trava
em cada Groq 429.

**V.1.b — Express Cache-Control granular**

`src/server/index.ts:138` antes: `maxAge: '1h'` pra TUDO (incluindo sw.js
e index.html). Resultado: cada deploy = 1h pra propagar.

Depois: `setHeaders` granular:
- `/assets/*` (vite hashed): `max-age=31536000, immutable` (1 ano — URL muda)
- `sw.js + index.html + manifest`: `no-cache, must-revalidate` (sempre fresh)
- icons SVG e resto: 1h

SPA fallback (`app.get(/^(?!\/api).*/)`) também ganha no-cache. Browser
sempre puxa index.html fresh → bundle hash novo → app atualizado.

### V.2 — DM tool calls preservadas no retry (CRÍTICO playtest)

Bug observado no playtest 2026-05-29 com Lyra mago:
1. Player click "Atacar" em ação livre
2. DM chamada: narração="" + toolCalls=[start_combat, suggest_actions]
3. `dm.ts:151` detecta vazio + toolCalls → dispara retry-sem-tools
4. 2ª chamada: narração="O machado de Borin chia na chuva" + toolCalls=[]
5. **`response = nova resposta`** SUBSTITUI completamente a 1ª
6. Return retorna `toolCalls: response.toolCalls` = **[]** (perdidas!)
7. Resultado: DM narra lindo, **combate NUNCA INICIA**

Em estado de cascade Gemini overload (que vimos repetido), isso acontece
em ~30% das interações. F4 (combate D&D) inacessível.

**Fix** em `dm.ts:146-180`:

```ts
const originalToolCalls = response.toolCalls;

if (!narration && response.toolCalls.length > 0 && !retriedWithoutTools) {
  // ... retry sem tools ...
}

const finalToolCalls = retriedWithoutTools && originalToolCalls.length > 0
  ? originalToolCalls
  : response.toolCalls;

return { narration, speaker, toolCalls: finalToolCalls, raw };
```

3 tests novos em `dm-narration-recovery.test.ts`:
- Preserva toolCalls da 1ª chamada quando retry dispara
- Caso normal sem retry: toolCalls vêm da chamada única
- Caso degenerado sem toolCalls originais: fallback gracioso

### V.3 — 4 micro-bugs do playtest

| # | Onde | Antes | Depois |
|---|---|---|---|
| **V.3.a** | `short-rest-overlay.ts:84` | `d10++3` (double `+`) | `d10+3` correto |
| **V.3.b** | `lobby-screen.ts:301` | "Wizard 5 steps" | "Passo a passo (~3 min)" |
| **V.3.c** | `long-rest-ritual.ts:23` | Ignora `force-motion` toggle | `reduced = OS && !forceMotion` |
| **V.3.d** | `login-screen.ts:182` | Submit eterno sem timeout | `Promise.race(submit, timeout 10s)` + msg humanizada |

## 3. Tests + Typecheck

| Antes V | Tests V.2 | Tests V.3 | Total |
|---|---|---|---|
| 1794 | +3 | +5 | **1802 verde** |

- `dm-narration-recovery.test.ts` +3 (V.2)
- `short-rest-overlay.test.ts` +4 (V.3.a guard incluindo "NUNCA contém ++")
- `long-rest-ritual.test.ts` +1 (V.3.c force-motion)

Typecheck: OK

## 4. Estado final

```bash
$ git log --oneline | head -6
<docs>  docs(V): HANDOFF ciclo V + CLAUDE.md
72adbd0 fix(V): infra deploy + tool retry preservation + 4 micro-bugs playtest
272d879 docs(U): HANDOFF ciclo U + CLAUDE.md (F4 entregue + roadmap corrigido)
a71e3b6 fix(U): tool call leak no narration + player echo PT-BR
7d2776b docs: HANDOFF ciclo T + CLAUDE.md atualizado
93b5b6e feat(T3): polish — ach hidden distinct + dice preview chips + long rest ritual visual
```

Tests: **1802 verde** · Typecheck: **OK** · Working tree: limpo após docs

Total da sessão (M+N+O+P+Q+R+S+T+U+V): 14 commits feature/fix + 10 docs, 1591 → 1802 tests (+211).

## 5. Próximos passos (após este deploy)

### Imediato (você)
1. Confirma deploy via `curl https://jsgame-drpe.onrender.com/` — procure por:
   - "Convocando o Mestre" (R3 fix presente)
   - "Resistências" (T2.1 presente)
   - Headers `Cache-Control: no-cache` em `/` e `/sw.js`
2. No painel Render, **adicionar GEMINI_API_KEY** (ai.google.dev gratuito, 1.5K req/dia).
   Sem isso, prod fica com Groq single = trava em 429.
3. Bônus: CEREBRAS_API_KEY (cloud.cerebras.ai, 1M tok/dia) + MISTRAL_API_KEY
   (console.mistral.ai, 500K/dia). 4 providers no cascade = quase imortal.

### Próximo ciclo
- Playtest humano (você + 1 amigo no mobile real) com tudo deployado
- Áreas não exercidas em playtest headless: combate via DM tool (com fix V.2),
  death save real (HP 0), spell cast em combate, sessão coop multi-player

## 6. Aprendizados Ciclo V (pra próxima sessão NÃO esquecer)

1. **Render free pode pausar auto-deploy silenciosamente.** Verificar via
   `curl -I /` o `last-modified` periodicamente. Se atrasou >24h, redeploy
   manual.

2. **`DM_PROVIDER=groq` em prod = trava em 429.** Sempre testar com mesma
   config que prod usa. Em dev sem essa env, auto-detect cascade salvava —
   máscara perigosa.

3. **Cache-Control granular é essencial.** `max-age=3600` em index.html =
   1h pra deploy aparecer. `no-cache` em entry points + immutable em
   assets hashed é o pattern certo.

4. **Tool calls + retry**: substituir `response` inteiro num retry perde
   dado valioso. Sempre snapshot do que importa antes.

5. **Diagnóstico antes de codar.** O usuário descreveu "atualizações não
   aparecem" — investigação revelou Render parado. Sem isso eu teria gasto
   tempo codando coisas que já estavam corretas mas não chegavam em prod.
