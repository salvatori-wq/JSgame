# JSgame — Handoff 2026-05-25 (F32 done · F33→F35 + QA next)

## 1. Estado atual

**Sessão atual completou 7 fases:** F22 (Gemini provider), F29 (CSS refactor modular), F30 (Layout responsivo desktop), F31 (Combat screen visual), F32 (Character sheet full PHB-like). Tudo commitado, **328/328 testes verdes**, typecheck limpo.

Plano profundo F23-F35 foi acordado em rolada autônoma única ("vai pra cima de tudo"). User pausou pra solicitar:
1. **Continuar do ponto onde parou** (F33, F34, F23-F27, F35)
2. **Ao final, rodar sequência QA focada em correção de bugs** (smoke playtest manual + revisão UX)

F28 (Inventory profundo) foi **excluído de propósito** do escopo — não criar.

## 2. O que falta executar (ordem)

### Sprint B continuação — UX Pilar II (resta 2 fases)
- [ ] **F33 — Wizard polish (criação PJ)** — 5 steps melhor: previews ao vivo (vê PJ mudando enquanto escolhe), comparação raça/classe lado a lado, point buy com sliders (não só botões), summary final tipo "ficha PHB" antes de salvar. ~4-5h.
- [ ] **F34 — Microinterações & dice viz** — Dice rolling animation 3D fake (CSS transform rotateX/Y, ~800ms). Damage numbers flutuantes em combat. HP bar damage flash. Hover states completos em TODOS botões. Skeleton loaders nos endpoints lentos. ~3-4h.

### Sprint C — Regras D&D Pilar I (5 fases)
- [ ] **F23 — Class features Big 7** — Mais transformador. Rage (Bárbaro), Action Surge + Second Wind (Guerreiro), Channel Divinity + Turn Undead (Clérigo), Ki + Flurry/Patient Defense (Monge), Bardic Inspiration (Bardo), Sneak Attack (Ladino), Wild Shape simplificado (Druida). Features de nv 1-5. Tracking uses (`sheet.classFeatureUses: Record<string, {used,max}>`), UI botões dedicados em combat action bar, persistência. ~8-12h.
- [ ] **F24 — Combat actions completas** — Opportunity Attack (reaction system), Grapple/Shove (athletics contested), Help (vantagem aliado próximo turno), Two-Weapon Fighting (bonus action), Disengage real (consome action), Dash (mov dobrado tracking), Bonus Action manager (1 por turno). ~5-7h.
- [ ] **F25 — Spell mechanics polish** — Concentration enforce (1 spell por vez, dano → CON save DC max(10, dmg/2)), Upcasting com escala (slot maior = mais dice), Ritual casting (10min sem gastar slot), Counterspell/Dispel Magic interactions. ~5-7h.
- [ ] **F26 — Damage types resistance/immunity** — Aplicar Resistance (dmg ½), Immunity (dmg 0), Vulnerability (dmg 2x) em `resolvePlayerAttack`/`resolveEnemyTurn`. Tags em monsters + magic items. Spell schools relevantes (Necromancy vs morto-vivo). ~3-4h.
- [ ] **F27 — Saves vs DC sistema unificado** — DM tool `request_saving_throw`. Generalize skill check pra qualquer ability save (FOR/DES/CON/INT/SAB/CAR vs DC). Aplicado em spells, traps, hazards. ~2-3h.

### Sprint D — Cleanup
- [ ] **F35 — Server refactor concerns** — Quebra `campaign.ts` (1283 LOC) em domain modules: `quest-handler.ts`, `combat-handler.ts`, `dm-tool-applier.ts`. `index.ts` (~1180 LOC) → handlers por feature em `src/server/routes/*` + `src/server/sockets/*`. Mantém testes verdes. ~8-12h.

### Sprint E — QA & bug fixes (NOVO — pedido na pausa)
- [ ] **QA1 — Smoke playtest completo** — Subir backend+frontend, criar PJ novo, abrir campanha, testar fluxo: explorar → skill check → combate → ataque → kill → XP/level-up → magia → death save → quest → sheet view → print. Documentar todos os bugs visuais/funcionais encontrados.
- [ ] **QA2 — Bug fixes priorizados** — Lista de bugs do QA1, atacar em ordem de severidade: regressão funcional > visual quebrado > polish.
- [ ] **QA3 — Cross-browser smoke** — Testar pelo menos Chrome desktop + mobile portrait (já com bons hábitos no projeto, mas confirmar layout F30 não quebra em algum viewport médio).
- [ ] **QA4 — Performance check** — Verificar latência Gemini real (cold start, cached request). Memory leaks no campaign-screen (longa sessão). CSS dev tools "Layout shifts".
- [ ] **QA5 — Tests audit** — Rever cobertura. Áreas críticas que podem ter gaps de teste: F18 quest XP distribution multi-PJ, F20 streak edge cases (timezone), F23 class features uses tracking, F25 concentration breaks.

## 3. Padrões aplicáveis (NÃO rediscutir)

- **Zero-budget inviolável**: nunca sugerir serviço pago sem confirmação explícita. Free tier sempre (memória `feedback_zero_budget.md`).
- **Provider**: agora é `gemini-2.0-flash` (F22), Groq como fallback. Chave em `.env` local (gitignored). Modelo `gemini-2.5-flash` se quiser mais qualidade — verificar quota antes.
- **CSS modular** (F29): tudo em `src/client/styles/*.css`. Nada novo em `styles.css` raiz — só `@import`. Design tokens em `_tokens.css`.
- **Responsive** (F30): breakpoints mobile <600 / tablet 600-1023 / desktop 1024-1439 / wide ≥1440. Adicionar em `responsive.css`.
- **Achievement events** (F17): se ação nova credita marco, chamar `camp.pushAchievementEvent(playerId, event)`. Drain automático no server.
- **DM tools novas**: declarar em `tools.ts` (validação clamp/sanitize), `prompts.ts` (descrição + schema), handler em `campaign.applyValidatedTool()`.
- **Testes**: Vitest mocking de `getDbClient` via `vi.mock` (ver `streaks.test.ts` ou `achievements.test.ts` pra template).
- **Commits semânticos**: F#NN — Título (descrição). Co-Authored-By trailer.

## 4. Arquivos-chave atuais (mapa para retomar)

**F22 (Gemini):**
- `src/server/dm/providers/gemini.ts` — provider via fetch nativo (sem dep nova). thinkingConfig.thinkingBudget=0.
- `src/server/dm/providers/factory.ts` — ordem auto-detect: Gemini > Anthropic > Groq.
- `.env` (gitignored) + `.env.example` — `GEMINI_API_KEY` documentado.

**F29 (CSS modular):**
- `src/client/styles.css` — 12 @imports.
- `src/client/styles/`:
  - `_tokens.css` (110 LOC) — vars: paleta, type-scale --fs-xs..--fs-3xl, --z-modal..--z-tour, --r-sm..--r-full, --shadow-*.
  - `boot.css` (221), `home-core.css` (99), `wizard.css` (904), `campaign-core.css` (487), `home-coop.css` (103), `campaign-party.css` (960), `combat.css` (~340 após F31), `lobby.css` (211), `modals.css` (860), `features.css` (157), `sheet.css` (F32 ~360), `responsive.css` (F30 ~170).

**F30 (Responsive):**
- `src/client/styles/responsive.css` — breakpoints. Bug-fix nota: usar classes específicas (`.home-owner-section`) em vez de `nth-of-type` por causa de ordem ambígua de sections.
- `src/client/main.ts` — `.home-owner-section` adicionada na section "Quem é você?".

**F31 (Combat polish):**
- `src/client/combat/combat-screen.ts` — initiative tracker com portrait via `portraitFor()` (F19), reordenado pra mostrar nº/avatar/nome.
- `src/client/styles/combat.css` — initiative virou horizontal scroll, pulse no `.is-current`, vinheta radial, action bar maior, enemy cards com ⚔ hover indicator.

**F32 (Sheet):**
- `src/client/sheet/sheet-screen.ts` (370 LOC) — SheetScreen class, 9 blocos.
- `src/client/styles/sheet.css` (360 LOC) — incluindo `@media print`.
- `src/client/main.ts` — `renderSheet()` agora delega pro SheetScreen.

## 5. Comandos essenciais

```bash
# Dev
npm run dev          # backend (3001) + frontend (5173) paralelo
npm run typecheck    # tsc --noEmit
npm test             # vitest run (328/328 atualmente)

# Smoke real Gemini (verificar quota)
curl -s "http://localhost:3001/api/health" | head -c 300
```

URLs: http://localhost:5173 (desktop) · http://192.168.15.3:5173 (mobile)

## 6. Commits desta sessão

```
a70fa67 F32 — Character sheet full view (PHB-like + print)
80b6856 F31 — Combat screen dedicada (visual polish + portrait + animações)
d115ad7 F30 — Layout responsivo desktop (tablet/desktop/wide)
7018aac F29 — CSS refactor modular (4377 LOC → 11 módulos)
5c7b0a9 F22 — Gemini Flash provider (free tier, sem auto-billing)
```

**Sessão anterior (F16-F21)** também ainda não pushada pra Render — total 12 commits locais a partir de `603e168` (último em prod).

## 7. Deploy / env

- URL prod: https://jsgame-drpe.onrender.com (ainda no commit F10 `603e168` antigo — push manual quando quiser)
- Repo: https://github.com/salvatori-wq/JSgame
- Turso DB: `jsgame-prod` em `aws-us-west-2`
- **Env vars novas pra prod F22**: `GEMINI_API_KEY` (free tier 1500/dia sem auto-bill). Já está em `.env` local. Pra prod no Render, adicionar manualmente no dashboard.

## 8. Bugs/observações conhecidas (não-bloqueantes)

- **HANDOFF antigos não commitados**: `HANDOFF_2026-05-25_F10-lobby-live.md` e `HANDOFF_2026-05-25_F15-auth-done.md` estão untracked. Decisão pendente: commitar histórico ou apagar?
- **Cliente força mobile classes mesmo em desktop**: `main.ts` adiciona `is-portrait-narrow`/`is-touch` baseado em pointer:coarse. Em F30 isso ATIVA o guard `body.is-portrait-narrow .home-screen { display: block }` que cancela o grid 2-col. Solução temporária no smoke foi via JS `document.body.classList.remove(...)`. **Bug real pra QA**: ajustar lógica em `main.ts` pra só aplicar `is-portrait-narrow` se viewport realmente <600px, não só baseado em pointer:coarse (touchscreen laptop = false positive).
- **Screenshot tool comprimido**: preview_screenshot às vezes renderiza viewport compressed (vide F30/F31 debug). `preview_inspect` é fonte da verdade pras medidas DOM.
- **Print de @media print não testado em browser real** — F32 fez stylesheet print mas não executei Ctrl+P. QA1 deve incluir.

## 9. 🎯 Mensagem pra próxima conversa

**Cole exatamente isto:**

> Lê `HANDOFF_2026-05-25_F32-done-F33+QA-next.md` na raiz. F22+F29-F32 estão commitados (5 commits, 328/328 verdes, typecheck limpo). Continuar autônomo o plano: **F33 (wizard polish) → F34 (microinterações & dice viz) → F23 (class features Big 7) → F24 (combat actions) → F25 (spell mechanics) → F26 (damage types) → F27 (saves vs DC) → F35 (server refactor)**. F28 fica fora.
>
> **Ao terminar F35, NÃO PARE — execute Sprint E (QA & bug fixes)**:
> 1. Smoke playtest manual end-to-end (criar PJ → campanha → combate → magia → death save → quest → sheet print)
> 2. Documentar TODOS os bugs encontrados
> 3. Atacar bugs em ordem de severidade
> 4. Cross-browser smoke (Chrome desktop + mobile portrait)
> 5. Performance check (Gemini latência, memory leaks, layout shifts)
> 6. Tests audit (cobertura em F18 multi-PJ XP, F20 streak timezone, F23 features uses, F25 concentration breaks)
>
> Regra zero-budget mantida. Commit semântico por fase. Tests verdes a cada parada.
>
> **Bug priority pra atacar primeiro no Sprint E**: lógica `is-portrait-narrow` em `src/client/main.ts` está dando false positive em touchscreen laptops — cancela layout F30 grid desktop. Fix: aplicar a class só se viewport <600px, não só por pointer:coarse.
