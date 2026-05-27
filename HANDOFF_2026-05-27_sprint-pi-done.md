# Handoff — Sprint π (Bottom Tab Bar Uber Native) — DONE

## 1. Estado atual

Working tree limpo após 3 commits batched + push origin/main. 1377 tests verde (+15 do bottom-tab-bar). Zero regressão. Sprint π entregue completo. Data: 2026-05-27.

```
git log --oneline | head -5
# (commit deste handoff)
# 96d20f9 feat(ui-π.3+π.4): chat absorvido pelo tab bar + layout dock 48vh
# c3f22e3 feat(ui-π.1+π.2): bottom tab bar uber native component + visual spec
# 6f045a9 docs: plano Sprint π (Bottom Tab Bar Uber Native) + handoff próxima sessão
# 07d604d docs: CLAUDE.md + HANDOFF da MEGA SESSION (19 commits, 8 sprints, +183 tests)
```

## 2. O que foi feito nesta sessão

1. Leitura completa do plano em `HANDOFF_2026-05-27_sprint-pi-plano.md` + `STRATEGY_PROXIMO_NIVEL.md` seção Sprint π. Decisões D10-D12 confirmadas (chat pill remove imediatamente / "Mais" abre overflow menu / solo swap Chat→Share).
2. **π.1 + π.2** (`c3f22e3`): `bottom-tab-bar.ts` NOVO componente standalone + `bottom-tab-bar.css` NOVO visual spec. 5 slots equal-width (grid 1fr × 5), active indicator dourado superior 2px com glow, badge unread pulsante 1.6s vermelho-sangue, touch feedback scale(0.95), density profile via body class (48/56/64), prefers-reduced-motion respeitado, haptic vibrate 10ms ao tap. Handle: setUnreadCount/setActiveTab/setQuestBadge/setAchievementsBadge/setCoop/destroy.
3. **π.3 + π.4** (`96d20f9`): `campaign-screen.ts` integração — slot novo `.ch-slot-bottom-tabs` no shell + `bottomTabBar` handle persistente + `currentOpenTab` tracker + `onBottomTabClick` roteia pra openQuestLog/openAchievementsModal/openNpcRosterModal/openPartyChat/shareCampaignId/openHeaderOverflow. Chat pill ο.2 destruída em portrait-narrow+coop (badge mora no slot Chat). Desktop coop continua com pill (sem regressão). `chat-sheet.ts` ganha `onClose` opcional pra notificar caller. `m-camp-dock.css` max-height `.ch-slot-main-content` 55vh→48vh + novo slot bottom-tabs.
4. **π.5 + π.6** (este commit): 15 tests bottom-tab-bar.test.ts (render coop/solo, badges, active state, toggle, click handlers, setCoop preserva badges, 99+ overflow), typecheck OK, 1377/1378 passing (1 skipped pre-existing). CLAUDE.md "Estado Atual" + Sprint π section + handoff de fechamento.
5. Validação visual via preview_inspect mobile 360×740: display grid 360px wide, height 56px, 5 tabs 72px cada, active gold rgb(244,208,127), badge red rgb(200,64,50), z-index 9290. `preview_screenshot` timeout (problema do tool — memória `ζ.6 audit 5 viewports PENDENTE`).
6. Push origin/main após cada commit (3 push). Auto-deploy Render deve disparar conforme rotina.

## 3. Contexto técnico relevante

- **Active state sync**: usa `markTabActive(tab|null)` chamado por cada handler. Modais (openQuestLog/openAchievementsModal/openNpcRosterModal) recebem `onClose: () => this.markTabActive(null)` callback. Chat-sheet ganhou `onClose` opcional na ChatSheetContext.
- **Toggle tap**: tap em tab já ativa fecha o modal correspondente — implementado em `onBottomTabClick` via early `if (this.currentOpenTab === tab) { closeCurrentTabModal(tab); return; }`. Smooth UX, evita "tab ativa mas fechei o modal de outro jeito".
- **Slot 5 "Mais"**: chama `openHeaderOverflow(anchor)` que abre o overflow menu existente com lista completa (sons/música/voz/memória/dificuldade/tela/glossário). Active state limpa em 100ms timer (overflow fecha sozinho via doc click). Reuso total do header-overflow-menu.ts γ.5.
- **Solo vs Coop**: tracking via `party.length > 1`. Em `updateBottomTabBar`, chama `setCoop(isCoop)` que re-renderiza só o slot 4 (chat ↔ share). Badges (quest/ach) preservados via state interno do handle.
- **Density profile**: CSS pure — body classes `ux-density-compact` / `ux-density-comfortable` (já existem em ux-prefs ο.8) sobrescrevem `--btb-height`. Sem código JS novo.
- **Reduced motion**: media query `@media (prefers-reduced-motion: reduce)` zera transitions/pulse/scale. Cliente com flag respeitada via system pref.
- **Memória `feedback_interface_alma`**: pegada Uber/Wash Me confirmada — bottom tab bar é evolução natural de ο.3 action dock topicizado.
- **Chat-pill ο.2 deprecation**: em portrait-narrow + coop, chat-pill é destruída em `updateChatBar`. Desktop coop mantém. Badge unread propaga pra ambos (chatPill + bottomTabBar) via `setUnreadCount`.

## 4. Fix/padrão central

Pattern definitivo de tab bar reusável — funcional, sem state externo necessário pelo caller além de "qual tab está ativa" (caller decide via setActiveTab):

```ts
// caller:
this.bottomTabBar = createBottomTabBar({
  isCoop: this.party.length > 1,
  unreadChatCount: this.unreadChatCount,
  onTabClick: (tab, anchor) => this.onBottomTabClick(tab, anchor),
});
this.slots.bottomTabs.appendChild(this.bottomTabBar.element);

// updates per render:
this.bottomTabBar.setCoop(this.party.length > 1);
this.bottomTabBar.setQuestBadge(activeQuests);
this.bottomTabBar.setUnreadCount(this.unreadChatCount);

// active state sync:
this.markTabActive('npcs');  // ao abrir modal NPCs
this.markTabActive(null);    // no onClose callback
```

CSS spec ativada por `body.is-portrait-narrow` — desktop esconde via `display:none !important`.

## 5. Follow-ups sugeridos

### Bloqueante/Done
- [x] π.1 bottom-tab-bar.ts + CSS
- [x] π.2 renderHeader mobile já minimalista (ο.1 status-ribbon cobre) — nenhum código removido (não havia botões no mobile pra remover, header full é desktop-only desde ο.1)
- [x] π.3 chat absorvido + chat-pill destruída em portrait-narrow+coop
- [x] π.4 m-camp-dock.css max-height 48vh + slot bottom-tabs
- [x] π.5 polish (haptic + density + reduced-motion + scale)
- [x] π.6 tests + typecheck + CLAUDE.md + HANDOFF

### Opcional (não bloqueante)
- [ ] **Playtest mobile real** — confirmar "parece Wash Me/Uber" (memória `feedback_interface_alma`). Validar tab bar não atrapalha narration em combate (max 48vh main-content deveria dar folga, mas medir em device real).
- [ ] **Métrica `bottom_tab_tap_distribution`** por slot — informa próximas iterações. Adicionar `trackClientMetric('bottom_tab_tap', { tab })` em `onBottomTabClick`.
- [ ] **Métrica `chat_open_via_tab_pct`** — deve substituir 100% do chat-pill flow em mobile.
- [ ] **Animar badge pop-in** quando incrementa (CSS keyframes scale 1.2 → 1 em 240ms ao mudar valor) — incremental, pode entrar em Sprint posterior.
- [ ] **Animação slide do active indicator** entre tabs (CSS transform translateX 200ms) — atual é toggle, smooth seria mais Uber-like. Avaliar custo.

### Sprints futuros (deferred)
- [ ] **Sprint μ** "Mestre Não Falha" (streaming SSE + cache + auto-swap) — só quando playtest provar latência atrito real
- [ ] **κ.1 tutorial Duolingo** + κ.3 hints contextuais + κ.4 modo treino — se métrica mostrar novato perdido
- [ ] **θ.1/2 weapon/armor PHB databases** completas — se feedback pedir equipamento mais variado
- [ ] **λ.4 boss multi-fase** + λ.3 enemy AI variada — se combate ficar previsível
- [ ] **ι.1 highlight share** com OG image — se viralizar
- [ ] **ν.1 presence indicators** (typing/online) — se coop ativo

## 6. Arquivos-chave tocados

### Novos
- `src/client/campaign/bottom-tab-bar.ts` (~180 LOC) — renderer + handle pattern
- `src/client/styles/bottom-tab-bar.css` (~140 LOC) — visual spec + density + reduced-motion
- `src/client/campaign/__tests__/bottom-tab-bar.test.ts` (~200 LOC) — 15 tests cobrem render coop/solo, badges, active state, toggle, click handlers, setCoop preserva badges, 99+ overflow, destroy

### Editados
- `src/client/campaign/campaign-screen.ts` — bottomTabBar handle field + currentOpenTab tracker + slot novo no shell + updateBottomTabBar + onBottomTabClick + markTabActive + closeCurrentTabModal + shareCampaignId + chat-pill destruição condicional em updateChatBar + openPartyChat onClose callback + cleanup no destroy
- `src/client/campaign/chat-sheet.ts` — ChatSheetContext.onClose opcional + externalOnClose chamado no onClose interno
- `src/client/styles/m-camp-dock.css` — `.ch-slot-main-content` max-height 55vh→48vh + novo `.ch-slot-bottom-tabs:empty { display: none }` + flex-shrink 0
- `src/client/styles.css` — `@import './styles/bottom-tab-bar.css'`
- `CLAUDE.md` — seção "Sprint π" adicionada no topo de Estado Atual + arquivos novos/editados

## 7. Deploy / ambiente

- Último commit em prod: `96d20f9` (π.3+π.4) + commit deste handoff. Auto-deploy Render deve disparar.
- URL prod: https://jsgame-drpe.onrender.com
- Render dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Cascade providers: Cerebras/Gemini/Groq/Cloudflare ativos. Mistral pendente `MISTRAL_API_KEY`. Anthropic NÃO habilitado (memória `zero-budget`).
- Stack inalterada: Vite + TS strict + Socket.io + Express + sql.js + groq-sdk. Backend porta 3001, frontend 5173 (`npm run dev`).
- 1377 tests verde (era 1362, +15 net). Typecheck OK. Sem warnings novos.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (escolher próximo sprint):**

> Lê `HANDOFF_2026-05-27_sprint-pi-done.md` + `STRATEGY_PROXIMO_NIVEL.md`. Sprint π entregue (bottom tab bar Uber). 1377 tests verde. Decide próximo: Sprint μ (streaming SSE — só se latência for atrito real) OU Sprint κ.1 (tutorial Duolingo — se métrica mostrar novato perdido) OU outro da seção 4 do STRATEGY.

**Opções específicas:**

1. **Validar Sprint π em prod antes de seguir:**
   > Sprint π pushed origin/main. Aguarda auto-deploy Render (~5-10 min). Curl `https://jsgame-drpe.onrender.com` confirma deploy. Mobile 360×740 real — abre uma crônica, valida tab bar visível bottom 56px, 5 slots, badge unread chat funciona, tap slot Mais abre overflow menu existente, tap Conquistas abre modal, tap mesma tab fecha. Reporta achados.

2. **Adicionar métrica bottom_tab_tap_distribution:**
   > Adiciona em `onBottomTabClick` (campaign-screen.ts) chamada `trackClientMetric('bottom_tab_tap', { tab })`. Whitelist em `src/server/routes/api.ts` (CLIENT_ALLOWED_KINDS). Tests pra cada slot. Push origin/main.

3. **Polish refino π.6+** (slide active indicator + badge pop-in):
   > Sprint π entregue mas com 2 polish opcionais: (a) active indicator slide-X 200ms entre tabs em vez de toggle, (b) badge pop-in scale 1.2→1 240ms quando count incrementa. Implementa, adiciona 2-3 tests, commita batched. Push origin/main.

4. **Próximo sprint Strategy:**
   > Sprint π done. Decisão de ROI: ler STRATEGY seção 4 "ordem recomendada". Próximo seria Sprint ξ (pendências) OU Sprint κ (onboarding) OU Sprint μ (streaming). Eu recomendo κ.1 tutorial Duolingo (~2h, alto ROI pra novatos) ou ξ.1 IndexedDB resilience (~1.5h, qualidade fundação). Decide qual ir.

5. **Playtest mobile real focado:**
   > Sprint π pushed + deployed. Em mobile real (não emulado), abre crônica coop com aliado, valida bottom tab bar é "Wash Me-like" (memória `feedback_interface_alma`). Particular: tab Chat funciona, badge unread mostra, density compact (48px) cabe bem, tap haptic sentível. Reporta UX feel — se for o que esperava.

Começa com a Opção curta se quer alinhar próximo passo. Se sentiu UX, opção 5 é o caminho.
