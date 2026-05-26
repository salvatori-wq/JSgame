# JSgame — Handoff 2026-05-25 (F15 auth done · plano F16-F21 acordado)

## 1. Estado atual

Tudo limpo, todos os commits feitos. Última atualização: 25/05/2026. Auth real com magic link implementado, testado end-to-end (curl OK), 218/218 tests verdes, typecheck limpo. **Sem pendências bloqueantes.** Plano F16-F21 acordado com o usuário pra próxima sessão — atacar tudo em rolada autônoma ("vai pra cima como antes"), igual ao bloco F12.1 → F14.

## 2. O que foi feito nesta sessão

1. **F11** — Wizard estendido com step Subclasse (nv 3) e step Nv 4 (ASI vs Feat). Commit `5e4bf4f`.
2. **F12** — RAG do Mestre via FTS5/BM25 do Turso. Tabela `memory_facts` + virtual FTS5 unicode61 PT-BR. Indexer fire-and-forget em tool calls. Retriever antes de cada narrate. Bloco `## MEMÓRIA DE CAMPANHA` no prompt. Commit `b8d7187`.
3. **F12.1** — RAG extensions: PJ-aware boost (focusNames vira termo OR), auto-resumo periódico via Groq (a cada 10 narrações), UI Memória do Mestre (modal com search/filtros), timeline cronológica, exponential backoff DM em 429/503 (3 tentativas, ~4s budget), doc cron-job.org pingando /api/health. Commit `0e65896`.
4. **F13** — Mobile polish: SFX procedurais via Web Audio API (9 sons, síntese pura), swipe-down nos modals, push notifications locais via Web Notifications API. Commit `aa83041`.
5. **F14** — Multi-classe completo PHB cap 6: matemática completa (caster level combinado, slot table nv 1-20, pré-req AND/OR), UI no review do wizard com modal "+ Adicionar classe", 20 tests novos. Commit `35321df`.
6. **Análise profunda + plano F15-F21** — diagnóstico de engagement (sem XP/level-up, sem auth, sem achievements, sem quests, sem identidade visual), 7 fases planejadas (~30h total, $0).
7. **F15** — Account real com magic link passwordless. Brevo HTTP API (300 emails/dia free sem cartão), fallback DEV imprime link no console. Opaque tokens (sem JWT, sem secret). Endpoints `/api/auth/*`. UI login screen + user badge no home. Socket auth middleware. Migration leve `characters.user_id` (idempotente via try/catch). 13 tests novos. Commit `fe8f9a8`.
8. **Aprendizado salvo** em memória: `feedback_zero_budget.md` — João reagiu duro a sugestão de fallback Anthropic; default a free tier sempre.

## 3. Contexto técnico relevante

**Stack auth (F15):**
- Opaque tokens via `crypto.randomBytes(32).toString('hex')` (64 chars hex). Sem JWT — permite revogar trivialmente (DELETE row) e zero secret env var.
- Magic link TTL 15min, sessão 30 dias com rolling renewal (renova se < 7 dias).
- Cookie httpOnly + sameSite=lax + Secure em prod. CORS reflete origin (não pode usar `*` com credentials=true).
- Email Brevo via HTTP API + `fetch` nativo (zero deps novas). `BREVO_API_KEY` env var; se ausente, modo DEV: console.log + devLink no response JSON.
- Migration `characters.user_id` é `ALTER TABLE ADD COLUMN` em try/catch (SQLite não tem `IF NOT EXISTS` pra ADD COLUMN).
- Backwards-compat total: PJs anônimos com `ownerName` continuam funcionando. PJ novo com user logado ganha `userId`. `listCharactersByUserId` quando logado, `listCharactersByOwner` quando anon.

**Stack RAG (F12):**
- FTS5 com tokenizer `unicode61 remove_diacritics 2` lida com acentos PT-BR.
- Stem raso (`stemFtsToken`) reduz plural antes do prefix wildcard (`goblins` → `goblin*` captura sing+plur).
- Auto-resumo opt-out via `MEMORY_AUTOSUMMARIZE=false`. Anti-duplicate via flag `summarizing` no Campaign.
- Mestre indexa via tool calls: `npc_speaks` (importance 1.4), `describe_scene` (1.2), `give_item` (1.0-1.3), `start_combat`/`end_combat` (1.2-1.3), quote literal de NPC quando speaker != Mestre (1.5).
- Retriever monta query de `ação_atual + local + 3 últimos eventos`, busca BM25 top-5 com PJ-aware boost.

**Stack F14 multi-classe:**
- `CharacterSheet.additionalClasses?` opcional, default `undefined`.
- `combinedCasterLevel` floor depois de somar (full × 1 + half × 0.5 quando nv≥2). Pact (Bruxo) e None excluídos.
- Tabela slots PHB pág 165 nv 1-20.
- `canMulticlassInto` valida pré-req em ambas as classes (origem + destino).

**Memórias relevantes a ler:**
- `feedback_zero_budget.md` — REGRA INVIOLÁVEL: João opera com orçamento zero. Nunca sugerir API/serviço pago sem confirmação explícita.
- Handoff anterior: `HANDOFF_2026-05-25_F10-lobby-live.md` se precisar de contexto F1-F10.

## 4. Fix/padrão central — Auth-aware endpoints

Padrão usado em endpoints que aceitam usuário logado OU anônimo (compat legado):

```ts
// src/server/index.ts — pattern em todos endpoints user-facing
app.get('/api/characters', async (req, res) => {
  const user = (req as ExpressReqWithUser).user;  // populado pelo middleware
  if (user) {
    // Logado: lista por userId (cross-device)
    res.json({ characters: await listCharactersByUserId(user.id) });
    return;
  }
  // Anon: fallback ownerName (compat legado)
  const owner = String(req.query.owner ?? '').trim();
  if (!owner) { res.status(400).json({ error: 'owner required' }); return; }
  res.json({ characters: await listCharactersByOwner(owner) });
});
```

Aplicar este padrão **em todo endpoint novo que envolva PJs/campanhas/dados-do-user**. Server confia só na sessão (req.user), nunca em userId enviado pelo cliente — pra evitar PJ-hijacking trivial.

Sockets seguem o mesmo padrão via middleware:
```ts
io.use(async (socket, next) => {
  const token = parseSessionCookie(socket.handshake.headers.cookie);
  if (token) {
    const user = await validateSession(token);
    if (user) (socket.data as { user?: User }).user = user;
  }
  next();
});
```

## 5. Follow-ups sugeridos

Plano F16-F21 acordado com o usuário. Bloqueante: **nenhum**. Todos opcionais, todos $0.

- [ ] **F16 — Core loop XP + Level-up** (~5-7h) — feature mais transformadora do plano. Campo `xp` já existe no sheet mas nada incrementa. Implementar XP awarding por kill (PHB tabela CR→XP), level-up engine (HP/slots/prof bonus/aplicação de `plannedLevel4Choice`), UI overlay "🌟 LEVEL UP" (já tem `playLevelUp()` pronto e nunca disparado), XP bar persistente.
- [ ] **F17 — Achievements** (~3-4h) — schema novo (user_id, achievement_id, unlocked_at), 30 marcos pré-definidos (First Nat 20, First Death, Killed Boss CR 10+, etc), tracker hooks em combat/spells/death, toast notification + página perfil.
- [ ] **F18 — Quest tracking** (~4-5h) — DM tools novos (`set_quest`, `update_objective`, `complete_quest`), quest log painel cliente, RAG: quests viram fact `kind=promise importance 1.7`, reward XP via complete_quest.
- [ ] **F19 — Identidade visual + death gravitas** (~3-4h) — PJ portrait via emoji combinatorial (race+class, zero asset), death persistence (lápides na home com epitafh gerado pelo Groq), página de perfil do PJ.
- [ ] **F20 — Social & retention** (~5-6h) — galeria pública de campanhas (opt-in markdown), daily streak, Web Push real com VAPID + service worker, highlight reel (Mestre tool `mark_highlight`).
- [ ] **F21 — Polish viciante** (~3-4h) — ambient music procedural (4 tracks via Web Audio), combo SFX (2 crits seguidos = som especial), onboarding tour novo user.

Opcionais soltos:
- [ ] **Smoke playtest coop** com amigo — validar RAG + auth em jogo real antes de empilhar mais features.
- [ ] **Configurar BREVO_API_KEY no Render** + `BREVO_SENDER_EMAIL` (precisa email verified no Brevo). Sem isso, login em prod fica em modo DEV log (link só no server console).
- [ ] **Push pro Render manual** (commits `5e4bf4f` → `fe8f9a8` ainda não foram).

## 6. Arquivos-chave tocados

**F15 — Auth (nova fase):**
- `src/server/auth.ts` — Core: findOrCreateUser, createMagicLink, consumeMagicLink, createSession, validateSession, revokeSession, cleanupExpiredTokens. TTLs e constantes exportadas.
- `src/server/email.ts` — Wrapper Brevo HTTP API + template HTML magic link. Modo DEV via console.log quando key ausente.
- `src/server/__tests__/auth.test.ts` — 13 tests (mock de getDbClient via vi.mock).
- `src/server/persistence.ts` — Schema users + email_tokens + sessions + migration leve characters.user_id. `listCharactersByUserId` exposto.
- `src/server/index.ts` — CORS com credentials, cookie helpers manuais, app.use middleware auth, 4 endpoints `/api/auth/*`, socket middleware, atualização de `/api/characters` e POST `/api/characters` pra usar userId.
- `src/client/auth/login-screen.ts` — Tela de login magic link (form + sent + DEV warning).
- `src/client/api.ts` — fetchJson com credentials='include' default, getMe/requestMagicLink/logout/updateDisplayName.
- `src/client/main.ts` — Router ganha view `login`, bootstrap async hidrata `currentUser` via getMe, user badge no home.
- `src/client/styles.css` — Estilos login + user-badge.
- `src/shared/types.ts` — `CharacterSheet.userId?` opcional.

**F11-F14 (memória recente):**
- `src/dnd/multiclass.ts` + `src/dnd/__tests__/multiclass.test.ts` — Matemática PHB cap 6.
- `src/client/character-creation/multiclass-modal.ts` + step-feat.ts + step-subclass.ts.
- `src/server/memory.ts` + `__tests__/memory.test.ts` + `__tests__/campaign-memory.test.ts` — RAG store.
- `src/client/campaign/memory-modal.ts` — UI Memória (modo Recentes + Timeline).
- `src/client/audio.ts` — 9 SFX procedurais Web Audio API.
- `src/client/notifications.ts` — Push notifs locais.
- `src/server/campaign.ts` — Hooks RAG indexer + auto-resumo + retrieveMemory.
- `src/server/dm/dm.ts` — Backoff exponencial + summarize method.

## 7. Deploy / ambiente

- **URL pública**: https://jsgame-drpe.onrender.com
- **Último commit em prod**: `603e168` (F10 lobby) — F11→F15 (6 commits novos) ainda NÃO foram pra prod. Push manual quando quiser.
- **Repo**: https://github.com/salvatori-wq/JSgame
- **Render service**: `srv-d8abeurbc2fs73ft0fpg` (free tier, Oregon)
- **Turso DB**: `jsgame-prod` em `aws-us-west-2`
- **Env vars setadas no Render**: GROQ_API_KEY, GROQ_MODEL=llama-3.1-8b-instant, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, DM_PROVIDER=groq, NODE_ENV=production, SERVER_PORT=10000
- **Env vars a adicionar pra F15 em prod**:
  - `BREVO_API_KEY` (obrigatório pra email enviar de verdade — sem isso, login em prod fica em modo DEV log)
  - `BREVO_SENDER_EMAIL` (opcional, default `noreply@jsgame.local`)
  - `BREVO_SENDER_NAME` (opcional, default `JSgame`)
  - `PUBLIC_URL` (opcional — se setado, magic link aponta pra essa URL; útil pra deploy com domínio próprio)
- **218/152 testes vitest verdes** localmente. CI não configurado.

Quirks já conhecidos:
- `npm ci --include=dev` no Render ignora devDeps na prática — build tools (`vite`, `typescript`, `tsx`) ficam em `dependencies`. Só `vitest` em devDeps.
- Render auto-deploy via webhook às vezes não dispara — forçar via dashboard "Manual Deploy".
- TPD Groq reseta em 24h rolling. Free tier 500k tokens/dia. Modelo `llama-3.1-8b-instant` cabe ~3x mais respostas que 70b.
- Auto-resumo (F12.1) adiciona ~10% TPD. Opt-out via `MEMORY_AUTOSUMMARIZE=false` no env.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar o plano F16-F21 como combinado):**

> Lê `HANDOFF_2026-05-25_F15-auth-done.md` na raiz do JSgame. F15 (auth magic link) tá pronto e commitado em `fe8f9a8`, 218/218 testes verdes. O plano F16-F21 foi acordado pra rolar autônomo igual ao bloco F12.1 → F14. Vai pra cima de tudo, só pare ao terminar. Manter regra zero-budget — sem API/serviço pago sem confirmar.

**Opções específicas (se quiser priorizar):**

1. **Só F16 (core loop XP + level-up):**
   > Lê o handoff. Quero atacar SÓ F16 com cuidado — é a feature mais transformadora do plano. XP awarding por kill (PHB tabela CR→XP), level-up engine (HP/slots/prof bonus/aplicar plannedLevel4Choice), UI overlay "🌟 LEVEL UP" (já tem playLevelUp() pronto, nunca disparado), XP bar persistente. Tests cobrindo a matemática. ~5-7h.

2. **F16 + F17 (XP + achievements) — combo mais viciante:**
   > Lê o handoff. Quero F16 (XP+level-up) e F17 (achievements) juntos — empilham bem. Achievements track marcos via DB (user_id, achievement_id), 30 pré-definidos (First Nat 20, etc), toast notification quando unlock, página de perfil. ~9-11h.

3. **F18 (quest tracking) primeiro — Mestre fica menos errático:**
   > Lê o handoff. Quero F18 antes do resto. DM tools novos set_quest/update_objective/complete_quest, quest log no painel cliente, RAG indexa quests com kind=promise importance 1.7, reward XP via complete_quest (vai depender de F16 — implementa juntos). ~4-5h + F16.

4. **Tudo F16-F21 em rolada autônoma:**
   > Lê o handoff. /goal faça todos os itens F16-F21 do plano, só pare ao terminar. Manter regra zero-budget. Padrão de execução igual ao bloco F12.1 → F14: tasks claras, commits semânticos por fase, tests verdes a cada parada, smoke real onde fizer sentido.

5. **Smoke playtest antes de empilhar:**
   > Lê o handoff. Antes de F16+, quero fazer um playtest coop curto com amigo pra validar F12 RAG + F15 auth em jogo real. Me ajuda a configurar BREVO_API_KEY no Render e push dos commits novos pra prod, depois acompanha eu jogando 15min e me ajuda a debugar qualquer regressão.

Começa com a Opção curta se quer continuar o plano combinado em rolada autônoma. Se quer fazer só uma parte ou validar antes, vai direto numa das 5.
