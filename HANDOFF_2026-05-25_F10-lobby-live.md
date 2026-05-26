# JSgame — Handoff 2026-05-25 (F10 lobby live · sessão coop real)

## 1. Estado atual

Tudo online e funcional. Última atualização: 25/05/2026 ~20:30 BR. Deploy `603e168` rodando em https://jsgame-drpe.onrender.com com Turso persistente. João e amigo (khARD) jogaram coop com sucesso, validaram 2 dispositivos simultâneos. Único atrito agudo da sessão: Groq free tier bateu TPD diária — mitigado trocando pra modelo `llama-3.1-8b-instant`. **Sem pendências bloqueantes.** Backend local e prod sincronizados.

## 2. O que foi feito nesta sessão

1. **F4** — Combate D&D 5e real (engine, UI, attack/dodge, enemy AI, conditions, death saves). Commit `00f508b`.
2. **F4 coop foundation** — mutex actionQueue, dmThinking broadcast, party panel, skill-check ownership, auto-rejoin localStorage.
3. **F4.polish + F5.1 magias** — timeout LLM 15s + fallback graceful, 30 magias D&D iniciais, cast spell modal. Commit `beea477`.
4. **F5.2 + F5.4 + F6 PWA + Render deploy** — short/long rest, death saves engine + overlay, PWA manifest + service worker, render.yaml. Commit `e256e7f`.
5. **F8 — Turso migration** — substituiu sql.js por libsql (async). Persistência grátis 9GB cross-deploy. Commit `abc278f`.
6. **F9 — Conteúdo estendido** — 35 monstros bestiary, 85 spells (nv 0-9), 33 subclasses, 30 feats, inventory UI completo, exhaustion 6 níveis. Commit `28bff8c`.
7. **5 fixes de deploy Render** — disk-free tier, tsx em deps, npm ci, baseUrl tsconfig, vite/typescript em deps. Commits `4cc1f60` → `e5e7df2`.
8. **F10 — Lobby pré-jogo** — LobbyManager server, LobbyScreen client, criar PJs juntos com presença real-time. Commit `603e168`.
9. **Smoke coop real validado** — você + khARD em 2 dispositivos, party panel com 2 PJs, narração broadcast OK.
10. **Run-around TPD Groq** — `GROQ_MODEL=llama-3.1-8b-instant` setado via env var (não precisa push), modelo menor cabe mais respostas no limite diário.

## 3. Contexto técnico relevante

**Render free tier quirks** (aprendidos a duro custo nesta sessão):
- Não suporta disco persistente → SQLite local é ephemeral → migrou pra Turso.
- `npm ci --include=dev` **ignora** devDeps na prática mesmo com a flag. Solução: build tools (`vite`, `typescript`, `tsx`) ficam em `dependencies`. Só `vitest` em devDeps.
- Auto-deploy via webhook às vezes não dispara → manual deploy via dashboard.
- Cold start ~30s após 15min idle.
- Restart durante jogo derruba socket de todos — players precisam F5 (auto-rejoin do localStorage volta pra mesma campanha).

**TS quirks**:
- `tsconfig.json` sem `baseUrl` + `paths` (Render TS estrito rejeita). Imports todos relativos. Path aliases também removidos do `vite.config.ts`.
- TS pinado exato em `5.9.3` (sem caret) pra build reprodutível.

**Groq free tier**:
- TPD (tokens per day) é **por organização**, não por modelo — trocar de modelo não duplica o limite, mas modelo menor consome menos por chamada.
- Tier free: 500k tokens/dia (`llama-3.1-8b-instant` cabe ~3x mais respostas que `llama-3.3-70b-versatile`).
- Fallback graceful em `src/server/dm/dm.ts` retorna `Mestre (degradado)` quando LLM falha — usuário vê "Mestre travou no éter". 3x clique rápido = 3 mensagens iguais.

**Lobby state model**:
- In-memory no server (não persiste). TTL 1h após último player sair.
- Player tem status: `joined` / `selecting` / `wizard` (com `wizardStep`) / `ready`.
- Host = primeiro player. Se host sai, primeiro restante vira host.
- ID 6-char alfanum case-insensitive pra digitar fácil.
- Quando host inicia, server cria Campaign + adiciona todos PJs ready do lobby + emite `lobbyRedirect`.

**Decisão de design importante**: coop é "join existing campaign" OU "lobby pré-jogo". Lobby é pra antes de começar (criar PJs juntos), código de campanha é pra entrar mid-game.

**Memória relevante**: o handoff anterior é `HANDOFF_2026-05-25_F3-done-F4-next.md`. Pode ler pra contexto F1-F3 se nova sessão precisar.

## 4. Fix/padrão central — Coop-safe state mutation

Padrão usado em todo método assíncrono do `Campaign` (mutex serializa LLM calls de 2+ players simultâneos):

```ts
// src/server/campaign.ts
async takeAction(playerId: string, action: ...): Promise<DMResponse> {
  return this.enqueue(async () => {
    const response = await this.dm.narrate({ ... });
    this.applyDMResponse(response);
    return response;
  });
}

private enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = this.actionQueue.then(fn, fn);
  this.actionQueue = next.catch(() => undefined);
  return next;
}
```

Aplicar em **toda operação que mexe em state da Campaign**: `takeAction`, `resolveSkillCheck`, `playerCombatAction`, `playerCastSpell`, `useItem`, `shortRest`, `longRest`, `rollDeathSave`. Sem isso, dois players agindo simultâneo corrompem `recentEvents`, `combat.log`, ou disparam 2 chamadas LLM paralelas.

## 5. Follow-ups sugeridos

Pendências reais ordenadas por valor/esforço:

- [ ] **Fallback Anthropic Claude** (~30min) — quando Groq dá 429, tenta Anthropic. Requer `ANTHROPIC_API_KEY` no Render (paid, mas $5 de crédito grátis pra começar). Resolve definitivamente o problema TPD.
- [ ] **UI subclasses no wizard nv 3** (~2h) — data em `src/dnd/subclasses.ts` (33 archetypes), falta picker no `step-class.ts` ou step novo. Mago precisa escolher escola, Clérigo domínio, etc.
- [ ] **UI feats no wizard nv 4** (~2h) — data em `src/dnd/feats.ts` (30 feats), falta UI pra escolher ASI vs Feat ao subir nível 4.
- [ ] **F9.5 Multi-classe** (~3-4h) — `additionalClasses` no sheet, slot math combinado (PHB pág 163), UI no wizard pra adicionar 2ª classe.
- [ ] **F10 sistemas avançados** (~10h) — replay de campanhas, combat grid 2D, RAG memory pro Mestre lembrar cross-session.
- [ ] **F11 polish mobile** (~4-6h) — push notifications PWA, sound effects (d20, hit, level up), theme switcher, dark mode toggle.
- [ ] **F12 comunidade** (~8-12h) — galeria de campanhas públicas, matchmaking, achievements.
- [ ] **F13 TTS + voice chat** (~6h) — ElevenLabs ou Web Speech API pro Mestre falar, WebRTC voice party.
- [ ] **F14 lore engine** (~12h) — NPCs com memória persistente cross-session, world map procedural.
- [ ] **Optional: refatorar fallback DM** — adicionar exponential backoff em 429 antes de cair pro degraded message. Hoje cai direto.
- [ ] **Optional: TTL menor pro Render free** — fazer ping cron-job.org pra evitar cold start (não resolve dados, mas tira os 30s de espera ao acordar).

Bloqueante: **nenhum**. Tudo é incremental.

## 6. Arquivos-chave tocados nesta sessão

- `src/server/lobby.ts` — LobbyManager in-memory.
- `src/client/lobby/lobby-screen.ts` — LobbyScreen component (lista players, status, mode toggle).
- `src/server/campaign.ts` — Campaign engine com mutex + integração rest/death/spell/inventory.
- `src/server/combat.ts` — combat engine D&D (initiative, attack, enemy AI).
- `src/server/spells-engine.ts` — resolução de magias (damage com save, heal, condition).
- `src/server/persistence.ts` — Turso/libsql (async).
- `src/server/dm/dm.ts` — graceful fallback em LLM failures.
- `src/server/dm/prompts.ts` — system prompt + 9 tools (start_combat com `monsterId`, apply_condition, apply_exhaustion, end_combat).
- `src/server/dm/tools.ts` — validação server-side de tool calls.
- `src/dnd/monsters.ts` — 35 monstros CR 0-21.
- `src/dnd/subclasses.ts` — 33 archetypes.
- `src/dnd/feats.ts` — 30 feats.
- `src/dnd/spells.ts` — 85 spells (nv 0-9).
- `src/dnd/spell-slots.ts` — tabela slots por classe/nível.
- `src/client/campaign/campaign-screen.ts` — central UI (party panel, narração, ações, death save banner).
- `src/client/combat/combat-screen.ts` — UI combate (initiative tracker, enemy portraits, action grid).
- `src/client/spells/cast-spell-modal.ts` — modal grimório + target picker.
- `src/client/inventory/inventory-modal.ts` — equipar armas/armaduras, usar poções.
- `src/shared/types.ts` — todos os types compartilhados + socket events.
- `render.yaml` — config deploy (Turso vars sync:false, build sem --include=dev).
- `tsconfig.json` — sem baseUrl/paths, ignoreDeprecations 5.0.

## 7. Deploy / ambiente

- **URL pública**: https://jsgame-drpe.onrender.com
- **Último commit em prod**: `603e168` (F10 lobby) + env var `GROQ_MODEL=llama-3.1-8b-instant` (não tem commit, é só env).
- **Repo**: https://github.com/salvatori-wq/JSgame
- **Render service**: `srv-d8abeurbc2fs73ft0fpg` (free tier, region Oregon)
- **Turso DB**: `jsgame-prod` em `aws-us-west-2` (co-localizado com Render)
- **Env vars setadas** no Render: `GROQ_API_KEY` (encrypted), `GROQ_MODEL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (encrypted), `DM_PROVIDER=groq`, `NODE_ENV=production`, `SERVER_PORT=10000`.
- **Stats build**: 160KB JS gz 46KB, 52KB CSS gz 9KB.
- **152 testes vitest** verdes.

Quirks pra próxima sessão saber:
- Não fazer push enquanto vocês estão jogando — derruba socket.
- Render às vezes não auto-deploya com webhook → forçar via dashboard "Manual Deploy → Deploy Latest Commit".
- TPD Groq reseta em 24h rolling window (não em meia-noite UTC). Se bater de novo, considera fallback Anthropic ou troca conta.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar sem decidir nada):**

> Lê `HANDOFF_2026-05-25_F10-lobby-live.md` na raiz do JSgame. Jogamos coop ontem com sucesso, deploy `603e168` no ar. Quero discutir próximos passos e executar a maioria em seguida.

**Opções específicas (já sabendo o que quer atacar):**

1. **Fallback Anthropic pra resolver TPD definitivamente:**
   > Lê o handoff. Quero adicionar fallback automático Anthropic quando Groq dá 429 (TPD). Implementa em `src/server/dm/dm.ts` — se Groq falha com rate limit, tenta Anthropic se `ANTHROPIC_API_KEY` está setada. Eu adiciono a key no Render depois.

2. **UI de subclasses + feats no wizard:**
   > Lê o handoff. Quero adicionar UI pra subclasses (nv 3) e feats (nv 4) no wizard de criação. Data já existe em `src/dnd/subclasses.ts` e `src/dnd/feats.ts`. Falta picker no wizard. Mago escolhe escola, Clérigo escolhe domínio, etc.

3. **F9.5 multi-classe completo:**
   > Lê o handoff. Quero implementar multi-classe (PHB cap 6). Sheet ganha `additionalClasses: [{classId, level}]`, slot math combinado (full caster level + half caster /2), restrições de proficiência. UI no wizard pra adicionar 2ª classe ao subir.

4. **F10 sistemas avançados (replay + RAG memory DM):**
   > Lê o handoff. Quero atacar F10 sistemas avançados: replay de campanhas (timeline + snapshots) e Mestre IA com memória cross-session via RAG vetorial. Primeiro o replay (mais fácil), depois RAG.

5. **F11 polish mobile + push notifications:**
   > Lê o handoff. Quero F11 polish mobile: push notifications PWA pra "é teu turno", touch gestures pra dispensar overlays, sound effects (d20 rolando, hit/miss, level up), theme switcher.

Começa com a Opção curta se quer planejar e priorizar antes de executar. Se já decidiu o que vai atacar, vai direto em 1-5.
