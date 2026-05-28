# Handoff — Pré Sprint W (consultoria + plano detalhado)

## 1. Estado atual

**Data**: 2026-05-29 · **Working tree limpo · Sem pendências de código · 1802 tests verde · Push em prod OK até `6da7df5`**.

Plano Sprint W detalhado e commitado. Sprint NÃO executado ainda — é o trabalho da próxima sessão.

## 2. O que foi feito nesta sessão

1. **Ciclos S+T+U+V de polish entregues** — 1591 → 1802 tests (+211), 14 commits feature/fix + 10 docs.
2. **Diagnóstico crítico de deploy** — descoberto que Render auto-deploy parou em 28/05 03:22 GMT; 41 commits não deployados. João fez redeploy manual. Ajustei `render.yaml` (removida `DM_PROVIDER=groq` que forçava single provider em prod) e Express cache-control granular (`72adbd0`) pra prevenir reincidência.
3. **Ciclo V — fix bug crítico tool retry** (`72adbd0`) — `dm.ts` perdia `toolCalls` da 1ª chamada quando retry-sem-tools disparava. Resultado: DM narrava lindo mas combate nunca iniciava em ~30% das sessões sob Gemini overload. Snapshot `originalToolCalls` antes do retry. +3 tests.
4. **Ciclo V — 4 micro-bugs do playtest** — d10++3 fórmula short rest, lobby "Wizard 5 steps" desatualizado, long rest ritual ignorava `force-motion`, login email timeout 10s. +5 tests.
5. **João reportou frustração**: "chat ruim, dado não existe, campo de batalha não intuitivo, longe de funcional". Spawnei 2 consultores especialistas em paralelo: D&D sênior (ex-Wizards) + UX Mobile RPG (Genshin/Marvel Snap/BG3 mobile).
6. **Consultores convergiram em 3 diagnósticos críticos**: (a) dado tem 2 sistemas paralelos legacy (`die-3d` skill-check + `atk-die` spinner CSS combat), pequeno e dividindo protagonismo; (b) combate tem 3 sistemas de ação coexistindo = 22+ pontos de decisão por turno; (c) narração do Mestre indistinguível visualmente de chat — falta read-aloud box estilo PHB.
7. **Score atual JSgame Mobile**: 5.5/10 vs Marvel Snap 9.5, Genshin 8.5, Disco Elysium 9. Veredito unificado: *"backend SABE D&D, frontend NÃO PARECE D&D"*.
8. **SPRINT_W_PLANO.md criado e commitado** (`6da7df5`) — plano de execução detalhado em 4 sub-sprints (W1 Dado Protagonista, W2 Mestre Narrativo, W3 Combate Target-First, W4 Polish + re-check consultores). 417 linhas, cobre TODAS as 10+ recomendações dos 2 consultores. Pushed pra origin.

## 3. Contexto técnico relevante

**O paradoxo do JSgame**: backend D&D é profissional (Mearls, Mulligan, Baker, Blades-style clocks, F4 completo com 105 tests em combat/spells/saving-throw/reactions/concentration). Mas frontend foi otimizado em 9 ciclos de polish marginal (M+N+O+P+Q+R+S+T+U+V renderam +211 tests, zero deslocamento da experiência percebida). Consultor D&D nomeou isso: *"investimento mal alocado em didática quando o problema é drama, mistério e respiração"*.

**Causa raiz da percepção "dado não existe"**: NÃO é bug. É (i) `.die-3d` é um `<div>` quadrado plano com `rotateX/Y/Z` num plano CSS = 3D pobre, (ii) `.atk-die` em combat é literalmente um spinner CSS rotate genérico, (iii) dado tem 80×88px ladeado por 2 chips no skill-check overlay = divide protagonismo. Os 2 consultores DIAGNOSTICARAM ISSO INDEPENDENTEMENTE.

**Decisão arquitetural pra Sprint W**: NÃO é rewrite. É CSS+wiring focado em 5 pontos de alto ROI. O backend não muda (exceto W2.5 `suggest_actions` opcional no system prompt e W3.6 clamp 3 chips no validator). Tudo é mexer em `dice-3d.ts/css`, `narration-log.ts/css`, `combat-screen.ts/css`, `chat-sheet.ts` (deprecar), `prompts.ts` (1 linha), `tools.ts` (1 validator).

**O Ciclo V CONSERTOU o bug de tool retry** (commit `72adbd0`). Isso é importante porque o consultor D&D NÃO sabia disso quando auditou — ele recomendou "combat target-first" mas a infraestrutura de combat (start_combat tool call) agora funciona corretamente. O Sprint W vai potencializar o que já funciona.

## 4. Fix/padrão central

O Ciclo V estabeleceu padrão de "snapshot antes de retry" que se aplica em qualquer LLM cascade:

```typescript
// src/server/dm/dm.ts:146-180
let parsed = extractJson(response.text);
let narration = stripInlineToolMentions((parsed.narration ?? response.text).trim());

// Snapshot toolCalls da PRIMEIRA chamada antes de qualquer retry.
const originalToolCalls = response.toolCalls;

if (!narration && response.toolCalls.length > 0 && !retriedWithoutTools) {
  response = await this.callWithBackoff(systemPrompt, userPrompt, false);
  retriedWithoutTools = true;
  parsed = extractJson(response.text);
  narration = stripInlineToolMentions((parsed.narration ?? response.text).trim());
}

// Usa toolCalls ORIGINAIS quando retry-sem-tools aconteceu.
const finalToolCalls = retriedWithoutTools && originalToolCalls.length > 0
  ? originalToolCalls
  : response.toolCalls;

return { narration, speaker: parsed.speaker, toolCalls: finalToolCalls, raw };
```

Padrão Cache-Control granular do V.1.b (`src/server/index.ts:138`) também vale replicar em qualquer SPA Express:

```typescript
app.use(express.static(staticDir, {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(sw\.js|index\.html|manifest\.webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));
```

## 5. Follow-ups sugeridos

- [ ] **(Bloqueante)** Executar Sprint W em ordem W1 → W2 → W3 → W4 conforme `SPRINT_W_PLANO.md`. Cada Wn termina com typecheck + tests + commit. Push só no fim do W4.
- [ ] **(Bloqueante no W4)** Re-spawnar os 2 consultores (D&D + Mobile) DEPOIS de W1+W2+W3 prontos. Critério de sucesso: D&D ≥ 8/10 e Mobile ≥ 7.5/10 (era 5.5).
- [ ] **(Opcional)** João adicionar `MISTRAL_API_KEY` no Render (500K req/dia free, https://console.mistral.ai) pra cascade virar 5-tier. Já tem 4 funcionando (Cerebras/Groq/Gemini/Cloudflare).
- [ ] **(Opcional)** Investigar Render auto-deploy stale (parou em 28/05 03:22 GMT). Painel pode estar com webhook GitHub desconectado ou build minutes esgotadas. Sem isso, próximos pushes podem precisar de redeploy manual.
- [ ] **(Opcional, baixa prioridade)** Após Sprint W aprovado pelos consultores, validar com playtest humano real (João + 1 amigo no celular). Métricas reais > inferidas.

## 6. Arquivos-chave tocados

- `C:\Users\JOÃO\JSgame\SPRINT_W_PLANO.md` — Plano de execução detalhado da próxima sessão. **LER PRIMEIRO.**
- `C:\Users\JOÃO\JSgame\render.yaml` — V.1 removeu `DM_PROVIDER=groq` + adicionou placeholders GEMINI/CEREBRAS/MISTRAL keys.
- `C:\Users\JOÃO\JSgame\src\server\index.ts` — V.1.b Cache-Control granular setHeaders.
- `C:\Users\JOÃO\JSgame\src\server\dm\dm.ts` — V.2 `originalToolCalls` snapshot pattern.
- `C:\Users\JOÃO\JSgame\src\server\__tests__\dm-narration-recovery.test.ts` — +3 tests V.2 + casos existentes.
- `C:\Users\JOÃO\JSgame\src\client\campaign\short-rest-overlay.ts` — V.3.a fix d10++3.
- `C:\Users\JOÃO\JSgame\src\client\campaign\long-rest-ritual.ts` — V.3.c force-motion honor.
- `C:\Users\JOÃO\JSgame\src\client\lobby\lobby-screen.ts` — V.3.b "Wizard 5 steps" → "Passo a passo".
- `C:\Users\JOÃO\JSgame\src\client\auth\login-screen.ts` — V.3.d email timeout 10s + humanized errors.
- `C:\Users\JOÃO\JSgame\CLAUDE.md` — atualizado com Ciclos U+V.
- `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-29_ciclo-V-infra-tool-retry-fix.md` — handoff V.
- `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-29_ciclo-U-playtest-tool-leak-fix.md` — handoff U (descoberta do tool leak no playtest).

## 7. Deploy / ambiente

**Último commit em origin/main**: `6da7df5 docs: SPRINT_W_PLANO.md`.
**Último commit em prod**: deploy mais recente do João foi 28/05 18:19 GMT (bundle `index-D4RCQ8Ih.js`). Os commits V (`72adbd0`, `861f956`) e plano W (`6da7df5`) foram pushed depois e o Render deve estar deployando agora (ou esperando trigger manual se auto-deploy ainda estiver stale).

**Verificar prod via**:
- `curl -sI https://jsgame-drpe.onrender.com/` (last-modified deve ser recente)
- `curl -s https://jsgame-drpe.onrender.com/api/dm/diag` (cascade 4 providers OK)
- `curl -s https://jsgame-drpe.onrender.com/api/health` (uptime + provider status)

**Cache do navegador**: V.1.b Cache-Control granular vai vigorar SÓ do próximo deploy em diante. Versões antigas (sw.js + index.html servidos com `max-age=3600`) podem ainda estar cached em browsers que abriram o app antes. Se você ainda vir tudo igual, abrir Chrome DevTools → Application → Service Workers → Unregister + Clear storage, recarregar.

**API keys configuradas no Render** (verificado via `/api/dm/diag`): GEMINI, GROQ, CEREBRAS, CLOUDFLARE — todos os 4 respondem em 200-600ms. **NÃO precisa adicionar mais nada pra Sprint W funcionar**.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (deixar a próxima IA decidir):**

> Lê o `SPRINT_W_PLANO.md` na raiz do projeto JSgame e me diz como vai começar. Os 2 consultores (D&D + Mobile) auditaram o jogo e esse plano cobre as 10+ recomendações deles em 4 sub-sprints (W1 dado, W2 mestre narrativo, W3 combate target-first, W4 polish + re-check). Executa em ordem, cada sub-sprint termina com typecheck + tests + commit. Push só no fim do W4.

**Opções específicas:**

1. **Começar W1 Dado Protagonista direto:**
   > Lê `SPRINT_W_PLANO.md` seção "Sub-sprint W1 — DADO PROTAGONISTA" e executa todas as 6 mudanças (W1.1 matar atk-die, W1.2 skill-check dado 140px, W1.3 drama timing 2500ms/4000ms crit, W1.4 watchdog 10s, W1.5 crit screen flash, W1.6 sound layered). Termina com typecheck + tests verde + commit feat(W1). NÃO faz push ainda.

2. **Executar W1 + W2 (dado + mestre narrativo) e parar pra eu validar antes de W3:**
   > Lê `SPRINT_W_PLANO.md` seções W1 e W2 e executa as 2 sub-sprints inteiras (dado protagonista + mestre narrativo com read-aloud box + chat absorvido + log narrativo + suggest_actions opcional). Termina com 2 commits feature e me mostra screenshots/eval do estado antes de mexer no combate (W3 é o mais arriscado).

3. **Time-box: 2h focado em W1 + W3.1+W3.3+W3.4+W3.6 (sem refactor combat target-first):**
   > Lê `SPRINT_W_PLANO.md`. Quero fazer time-box de 2h focado em entregar valor visceral imediato sem o refactor arriscado de target-first. Executa W1 inteiro (dado) + W3.1 (fog of war esconder stats inimigo) + W3.3 (action economy sticky top) + W3.4 (AGORA-É-VOCÊ explícito) + W3.6 (clamp 3 chips). Pula W2 (mestre narrativo) e W3.2/W3.5 (target-first refactor) por enquanto.

4. **Spawnar os 2 consultores DE NOVO com o plano pra eles revisarem ANTES de executar:**
   > Lê `SPRINT_W_PLANO.md` e os 2 handoffs de consultor desta sessão (HANDOFF_2026-05-29_pre-sprint-W.md, seção "O que foi feito"). Spawnar Agent tool com os 2 consultores (D&D sênior + UX Mobile RPG) passando o plano completo e pedindo: "esse plano cobre suas 5 recomendações originais? Falta alguma coisa? Algum item do plano é overkill?". Reportar feedback antes de executar.

Começa com a **Opção curta** se quiser que eu decida pela melhor ordem. Vai direto na **1** pra execução granular do W1. Vai na **3** pra ROI rápido sem o risco de refactor. Vai na **4** pra validar plano com os consultores antes de gastar 12-16h de execução.
