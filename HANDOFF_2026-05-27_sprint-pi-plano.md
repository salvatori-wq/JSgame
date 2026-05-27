# Handoff — Sprint π (Bottom Tab Bar Uber Native) — plano pronto pra executar

## 1. Estado atual

Working tree limpo (após commit deste handoff + STRATEGY update). 1362 tests verde. Sprint π planejado profundo mas NÃO executado. Próxima sessão executa π.1 → π.6 conforme plano em `STRATEGY_PROXIMO_NIVEL.md` seção "Sprint π". Data: 2026-05-27.

## 2. O que foi feito nesta sessão

1. MEGA SESSION antes deste handoff: 20 commits feature + docs, Sprints ο/η/ξ/κ/λ/θ/ι/ν entregues completos ou enxutos, 1179→1362 tests (+183 net). Último: `07d604d`. Detalhes em `HANDOFF_2026-05-27_mega-session-done.md`.
2. Playtest mobile do João validou pegada Uber funcional mas pediu refinamento: ícones 📜🏆👥🔗 ainda parecem chips perdidos no header — referência app "Wash Me" mostrou bottom tab bar persistente como melhor pattern.
3. Análise profunda da tela atual vs Wash Me identificou 7 problemas: 4 ícones do header pequenos, chat pill flutuante conflita visualmente com action dock, header tem peso desnecessário, falta presença permanente do chat coop, overflow menu ⋯ esconde opções importantes.
4. Plano Sprint π escrito e commitado em `STRATEGY_PROXIMO_NIVEL.md` — 6 sub-sprints (~6h total), decisões D10-D12 com recomendações, risk register, visual spec CSS completo, layout mental antes/depois.
5. Decisões D10-D12 confirmadas nas recomendações pelo usuário: (D10) remover chat pill imediatamente, (D11) "Mais" abre overflow menu existente, (D12) solo swap Chat→Share.

## 3. Contexto técnico relevante

- **Padrão sheet-stack-manager** (`src/client/sheet-stack-manager.ts`) é central — todos os modais novos devem usar pushSheet/popSheet em vez de gerenciar próprio z-index/backdrop. Tab bar tap → openModal correspondente.
- **Status Ribbon ο.1** (`src/client/campaign/status-ribbon.ts`) já é minimalista em portrait-narrow. Não precisa mudar pra Sprint π — só remover botões secundários do `renderHeader` desktop full.
- **Chat pill ο.2** (`src/client/campaign/chat-pill.ts`) vai ser deprecated. Lógica de unread count + `openPartyChat()` move pra tab bar slot Chat. Solo (`party.length === 1`) já esconde pill — mesmo comportamento no tab bar (slot Chat vira Share em vez).
- **Action Dock ο.3** (`src/client/campaign/action-dock-topics.ts`) NÃO muda. Continua intocado acima do tab bar. Apenas max-height de `.ch-slot-main-content` ajusta 55vh → 48vh em `m-camp-dock.css` pra dar 56px ao tab bar.
- **Density profile ο.8** (`src/client/ux-prefs.ts`) precisa integrar com tab bar — altura varia 48/56/64px por density. CSS var `--btb-height`.
- **Overflow menu ⋯** atual (`src/client/campaign/header-overflow-menu.ts`) já tem items configurados em `openHeaderOverflow` em campaign-screen — tab bar slot "Mais" reusa direto, passa próprio element como anchor.
- **Active state sync** entre tab bar e modal aberto: sheet-stack-manager pode ganhar callback `onPop` que tab bar escuta pra limpar active state. OU usar mecanismo de `currentOpenModal` mantido em campaign-screen state.
- Memória `feedback_interface_alma` valida pegada Uber/Wash Me — bottom tab bar é evolução natural dessa visão.

## 4. Fix/padrão central

Pattern bottom tab bar reusável — esqueleto pronto pra π.1:

```ts
// src/client/campaign/bottom-tab-bar.ts (PROPOSTO — NÃO EXISTE AINDA)
export type BottomTabId = 'quests' | 'achievements' | 'npcs' | 'chat' | 'share' | 'more';

export interface BottomTabBarContext {
  campaignId: string | null;
  isCoop: boolean;
  unreadChatCount: number;
  hasActiveQuest: boolean;
  newAchievements: number;
  onTabClick: (tab: BottomTabId) => void;
  currentOpenModal?: BottomTabId | null;
}

export interface BottomTabBarHandle {
  element: HTMLElement;
  setUnreadCount: (n: number) => void;
  setActiveTab: (tab: BottomTabId | null) => void;
  setQuestBadge: (count: number) => void;
  setAchievementsBadge: (count: number) => void;
  destroy: () => void;
}

export function createBottomTabBar(ctx: BottomTabBarContext): BottomTabBarHandle;
```

Layout CSS spec (em `bottom-tab-bar.css`):
```css
.bottom-tab-bar {
  position: sticky; bottom: 0;
  height: var(--btb-height, 56px);
  padding-bottom: var(--m-safe-bottom, 0px);
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: linear-gradient(180deg, rgba(20,12,8,0.97), rgba(8,4,6,0.99));
  border-top: 1px solid rgba(244,208,127,0.25);
  z-index: 9290;
}
.btb-tab.is-active { color: var(--gold); }
.btb-tab.is-active::before {
  content:''; position:absolute; top:0; left:20%; right:20%; height:2px;
  background: var(--gold); box-shadow: 0 0 8px var(--gold);
}
```

Layout flex final em `m-camp-dock.css`:
```
.camp-screen (100dvh flex column, portrait-narrow)
├─ header (~36px status-ribbon)
├─ party (max 22vh)
├─ narration-host (flex 1)
├─ pending-check (condicional)
├─ main-content (max 48vh) ← action-dock-topics ο.3
└─ bottom-tab-bar (56px + safe-area) ← NOVO π
```

## 5. Follow-ups sugeridos

### Bloqueante pra Sprint π estar "done"
- [ ] Implementar π.1 `bottom-tab-bar.ts` + CSS (~2h)
- [ ] π.2 refactor `renderHeader` mobile pra remover secundários
- [ ] π.3 deprecate chat-pill / wire tab bar slot Chat → openPartyChat
- [ ] π.4 m-camp-dock.css ajusta `max-height: 48vh` no main-content
- [ ] π.5 density profile + reduced-motion integration
- [ ] π.6 tests (~12 novos) + typecheck OK + push origin/main
- [ ] CLAUDE.md "Estado Atual" adiciona Sprint π
- [ ] HANDOFF de fechamento escrito pós-execução

### Opcional (não bloqueante)
- [ ] Playtest mobile real após π — confirma "parece Wash Me/Uber" (memória `feedback_interface_alma`)
- [ ] Tab bar haptic vibrate 10ms ao tap (UX feel)
- [ ] Métrica `bottom_tab_tap_distribution` por slot — informa próximas iterações
- [ ] Animar badge unread quando incrementa (pop-in) — pode entrar em Sprint posterior

### Sprints futuros (deferred)
- [ ] Sprint μ "Mestre Não Falha" (streaming SSE + cache + auto-swap) — só quando playtest provar latência atrito real
- [ ] κ.1 tutorial Duolingo + κ.3 hints contextuais + κ.4 modo treino — se métrica mostrar novato perdido
- [ ] θ.1/2 weapon/armor PHB databases completas — se feedback pedir equipamento mais variado
- [ ] λ.4 boss multi-fase + λ.3 enemy AI variada — se combate ficar previsível
- [ ] ι.1 highlight share com OG image — se viralizar
- [ ] ν.1 presence indicators (typing/online) — se coop ativo

## 6. Arquivos-chave tocados

### Editados nesta sessão (handoff/plano)
- `C:\Users\JOÃO\JSgame\STRATEGY_PROXIMO_NIVEL.md` — Sprint π completo adicionado (seção 3, cronograma, ordem recomendada, métricas, D10-D12)
- `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-27_sprint-pi-plano.md` — este handoff

### Arquivos a CRIAR na próxima sessão (Sprint π)
- `C:\Users\JOÃO\JSgame\src\client\campaign\bottom-tab-bar.ts` — renderer + state handle
- `C:\Users\JOÃO\JSgame\src\client\styles\bottom-tab-bar.css` — visual spec
- `C:\Users\JOÃO\JSgame\src\client\campaign\__tests__\bottom-tab-bar.test.ts` — ~12 tests

### Arquivos a EDITAR na próxima sessão
- `C:\Users\JOÃO\JSgame\src\client\campaign\campaign-screen.ts` — wire tab bar + remove chat-pill + refactor renderHeader mobile
- `C:\Users\JOÃO\JSgame\src\client\campaign\chat-pill.ts` — marcar @deprecated, no-op em portrait-narrow
- `C:\Users\JOÃO\JSgame\src\client\styles\m-camp-dock.css` — adiciona slot tab bar + ajusta max-height main-content
- `C:\Users\JOÃO\JSgame\src\client\styles.css` — `@import './styles/bottom-tab-bar.css'`
- `C:\Users\JOÃO\JSgame\src\client\styles\ux-settings.css` — density profile var `--btb-height`
- `C:\Users\JOÃO\JSgame\CLAUDE.md` — adiciona sessão Sprint π no "Estado Atual"

## 7. Deploy / ambiente

- Último commit em prod: `a47ed2c` (lobby personality preview) + `07d604d` (docs MEGA). Auto-deploy do Render deve disparar — manual deploy se travar.
- URL prod: https://jsgame-drpe.onrender.com
- Render dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Cascade providers: Cerebras/Gemini/Groq/Cloudflare ativos. Mistral pendente `MISTRAL_API_KEY`. Anthropic NÃO habilitado (memória zero-budget).
- Stack inalterada: Vite + TS strict + Socket.io + Express + sql.js + groq-sdk. Backend porta 3001, frontend 5173 (`npm run dev`).

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar com plano pronto):**

> Lê `HANDOFF_2026-05-27_sprint-pi-plano.md` e `STRATEGY_PROXIMO_NIVEL.md` seção "Sprint π" na raiz do JSgame. Plano profundo do Sprint π (Bottom Tab Bar Uber Native, ~6h, 6 sub-sprints) está pronto com decisões D10-D12 confirmadas nas recomendações. Executa π.1 primeiro (bottom-tab-bar.ts + CSS, ~2h), commita batched, vai pro π.2.

**Opções específicas:**

1. **Executar Sprint π inteiro autônomo (~6h, 4 commits batched):**
   > Lê `HANDOFF_2026-05-27_sprint-pi-plano.md` + seção Sprint π do STRATEGY. Executa autônomo π.1 → π.6. Decisões D10-D12 nas recomendações (chat pill remove imediatamente, "Mais" abre overflow menu, solo swap Chat→Share). Commits batched: (π.1+π.2) component + header refactor, (π.3+π.4) chat absorbed + layout dock, (π.5+π.6) polish + tests. Push origin/main após cada commit. CLAUDE.md + HANDOFF final ao terminar.

2. **Executar só π.1 primeiro pra review visual:**
   > Lê handoff + STRATEGY Sprint π. Implementa SOMENTE π.1 (`src/client/campaign/bottom-tab-bar.ts` + CSS + tests). NÃO wire em campaign-screen ainda — quero validar visual primeiro abrindo preview. Mostra screenshot em 360x740 portrait com tab bar mockado. Depois decidimos seguir pra π.2.

3. **Discutir variações de design antes de codar:**
   > Lê seção Sprint π do STRATEGY. Tenho dúvidas sobre o visual: deveria ser 4 slots em vez de 5? Active indicator deveria ser fill background em vez de border-top? Tab labels deveriam sumir em compact density? Me apresenta 3 mockups ASCII alternativos e recomenda um.

4. **Pular Sprint π e ir pra Sprint μ (streaming) ou outro:**
   > Lê HANDOFF mega da sessão anterior + STRATEGY. Pulo π por enquanto e vou pra Sprint μ.1 (streaming SSE) OU para Sprint κ.1 (tutorial Duolingo). Recomenda qual tem maior ROI agora dado que 1362 tests verde + 8 sprints já entregues.

5. **Playtest profundo antes de qualquer codigo novo:**
   > 19 commits da MEGA SESSION + 1 doc pushados em prod. Vamos validar primeiro: deploy Render OK? Curl `/api/dm/ux-funnel?days=2` retorna funil novo? Status ribbon + chat pill + action dock topicizado + mode transitions funcionando em mobile real? Lista checks específicos que devo rodar pra confirmar saúde antes de Sprint π.

Começa com a Opção curta se não tiver certeza — eu leio plano + memória e executo. Se já souber granularidade, vai direto numa das 5.
