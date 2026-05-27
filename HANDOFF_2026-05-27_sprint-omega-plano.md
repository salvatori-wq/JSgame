# Handoff — Sprint Ω (Polimento Definitivo) — plano pronto pra executar

## 1. Estado atual

Working tree limpo. **1431 tests verde**. Último commit `5f38a83` (deep audit pós-Sprint ψ). Tudo pushed origin/main, Render auto-deploy em curso.

```
git log --oneline | head -8
5f38a83 fix(polish-ψ-deep): 4 fixes pós-audit profundo — iOS scroll + empty state + saving/death save dado + sc-stage overflow
c433ebc fix(polish-ψ): dado skill-check visível + chat scroll preservado
6e92b09 feat(polish-ψ.3) + docs: DM Conductor — clocks Blades-style persistentes + CLAUDE.md + handoff Sprint ψ done
0b51cc4 feat(polish-ψ.4): modal native free — confirm/input/picker dialog helpers + substituição
7f9da75 feat(polish-ψ.5): quick wins — customDetails + swipe + debounce + appendError + métricas
ceaca43 feat(polish-ψ.2): chat alive — persistência + typing + anim + empty state D&D
64af801 feat(polish-ψ.1): dice drama — drop-in + settle + 96/112px + audio sync
e8cc907 feat(onboarding-κ.1): Tutorial Duolingo guiado com spotlight visual + 6 steps
```

## 2. O problema persistente

### 2.A — Dado AINDA não rola visualmente

**Screenshot recebida do João (2026-05-27 19:55)**:
- Overlay "FURTIVIDADE" aberto (skill-check de exploração)
- Chips visíveis: `DES +5` (verde) · `?` (dado, estático) · `DC 13` (vermelho)
- Botão de baixo: **"ROLANDO..."** (disabled, com loading dot)
- Estado: travado em "rolando" sem animação, sem reveal de número

**Já tentado nesta sessão (não resolveu)**:
1. ψ.1: keyframe `dieRolling` reescrito drop-in + settle + 1800ms — só `.dice-roll-overlay` (combate). Skill-check é outro overlay (.sc-overlay).
2. Hotfix `c433ebc`: skill-check ganhou `--die-drop-y: -60px`, dado 80/88px, duração 1500ms, `.sc-stage overflow: visible`.
3. Hotfix `5f38a83`: deep audit aplicou 4 fixes: iOS scroll, empty state guard, **death save + saving throw mostram dado animado**, sc-stage overflow visible.

**Mas João continua vendo "?" sem rolagem.**

**Hipóteses restantes (priorizadas)**:

| Prob | Causa | Como confirmar |
|---|---|---|
| **70%** | `prefers-reduced-motion: reduce` ativo no Chrome do Android. Reduce dispara keyframe `dieReducedFade` (opacity 0.5→1 em 200ms) — visualmente quase imperceptível. Player vê "?" por 200ms e troca pro número sem drama. | Pedir pro João abrir DevTools console e rodar `matchMedia('(prefers-reduced-motion:reduce)').matches`. Ou Settings Android → Acessibilidade → "Remover animações". |
| **15%** | Socket não está retornando `diceRollResult` com `purpose: 'skill-check'` → cliente nunca chama `showSkillCheckResult` → dado fica no `?` indefinidamente | Verificar logs server. Possível bug em `resolveSkillCheck`. |
| **10%** | Race condition: overlay destruído antes do `showSkillCheckResult` ser chamado | Add watchdog 5s |
| **5%** | Cache do browser/Service Worker antigo servindo CSS/JS pré-fix | Hard refresh + bump asset version |

### 2.B — Home menu confuso

**João disse**: "o menu inicial é uma confusão que só por deus! precisamos organizar as informações! Se inspire mais, veja outros exemplos, deixe o menu organizado!"

**Estado atual da home** (em `src/client/main.ts` função `renderHome`):
- Hero block (logo + tagline)
- Server status chips (servidor + mestre IA)
- Login bar (botão Entrar + nome owner)
- Owner-input ("Quem é você?")
- Prefab section (3 PJs Borin/Lyra/Sina)
- Botão "Personagem Customizado (Wizard)"
- "Seus personagens" (lista PJs)
- "Jogar em Coop" (criar lobby + joinar)
- "Joinar crônica em andamento" (input + botão)
- Crônicas ativas list (com preview ι.2)
- Cemitério + highlights links

Tudo aparece ao mesmo tempo. Player chega e é bombardeado. Hierarquia visual fraca, sem destaque do CTA principal.

## 3. PLANO PROFUNDO — Sprint Ω "Polimento Definitivo"

### Ω.1 — Dado funcional DEFINITIVO (~3h)

#### Ω.1.a — UX Setting "Forçar animações cinematográficas" (~1h)

**Problema**: `prefers-reduced-motion` do OS faz fade 200ms invisível.

**Fix**:
- `ux-prefs.ts` ganha campo `forceMotion: boolean` (default `true`)
- `applyUxPrefs()` adiciona `body.force-motion` class quando ativo
- CSS sobrescreve media query com `!important` quando body tem `.force-motion`:
  ```css
  body.force-motion .die-3d.is-rolling {
    animation: dieRolling 1800ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  body.force-motion .sc-stage .die-3d.is-rolling {
    animation: dieRolling 1500ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  body.force-motion .die-3d.is-rolling .die-shadow {
    animation: dieShadowSync 1800ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  ```
- `prefersReducedMotion()` em `dice-3d.ts` checa `body.force-motion`:
  ```ts
  export function prefersReducedMotion(): boolean {
    if (typeof document !== 'undefined' && document.body.classList.contains('force-motion')) {
      return false; // override do user "quero ver animação"
    }
    return window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
  }
  ```
- Adicionar toggle em `ux-settings-modal.ts` com label "🎲 Animações cinematográficas"

#### Ω.1.b — `rollAndReveal` robustez (~30min)

- Force browser repaint após `face.textContent = result`: `void face.offsetWidth`
- Re-query `.die-face` se null (defensive — caso DOM mude)
- Log telemetry `dice_roll_visual_started/completed` pra diagnóstico
- Diff entre start e completed → se > 3s, log warning telemetry

#### Ω.1.c — Fallback dramático em reduced-motion (~30min)

Mesmo em reduced-motion, garante drama visual perceptível:
- Novo keyframe `dieReducedReveal`: scale 0.6 → 1.15 → 1.0 + opacity 0 → 1 em **600ms** (não 200ms)
- Mostra 4-5 ticks de números aleatórios mesmo em reduced (não direto pro final)
- Number bounces 1 vez ao revelar (pulse)

#### Ω.1.d — Watchdog 5s (~30min)

- `skill-check-overlay.ts` ganha `watchdogTimer` no `rollAndDisable`
- Se 5s sem `showSkillCheckResult` chamar, mostra toast "DM travou. Tentar de novo?" + restaura botão
- Telemetry `dice_roll_timeout` quando dispara
- Mesma defesa no `dice-roll-overlay.ts` pra combat rolls

#### Ω.1.e — Diagnostic mode (~30min)

- Endpoint `/api/diagnostic/dice` que retorna estatísticas:
  - Última N rolls de skill-check do user
  - Tempo médio diceRollResult → showSkillCheckResult
  - prefers-reduced-motion detectado em quantos %
- Console hint: se reduced-motion detectado, log warn no início "Detectado reduced-motion — abra Settings > Animações pra ver dado completo"

#### Ω.1.f — Tests novos (~30min)

- `ux-prefs.test.ts`: forceMotion default true, toggle altera body class
- `dice-3d.test.ts`: forceMotion override de prefersReducedMotion
- `skill-check-overlay.test.ts`: watchdog após 5s
- ~5 tests novos

---

### Ω.2 — Home Tavern reorganizada (~6-8h)

#### Ω.2.a — Arquitetura nova (~30min)

Refactor: `renderHome` (atualmente 250+ linhas em `main.ts`) → componentes separados.

```
src/client/home/
├── home-screen.ts          NOVO — orquestra seções
├── sections/
│   ├── hero.ts             NOVO — logo + tagline
│   ├── identity-bar.ts     NOVO — avatar + nome + streak + status
│   ├── continue-card.ts    NOVO — preview rico da sessão ativa (rich preview já existe ι.2)
│   ├── play-now.ts         NOVO — 3 prefabs grandes
│   ├── coop-section.ts     NOVO — criar lobby + joinar (2 botões grandes)
│   ├── characters-list.ts  NOVO — collapsible "Meus PJs"
│   ├── chronicles-list.ts  NOVO — collapsible "Crônicas ativas"
│   ├── graveyard-link.ts   NOVO — collapsible "Cemitério"
│   └── footer.ts           NOVO — login/perfil/glossário/settings
└── styles/
    └── home-tavern.css     NOVO — substitui home-core.css
```

#### Ω.2.b — Hierarquia visual (~1h)

**Decisão estética inspirada em**: Wash Me (Brasil — bottom action + cards) · Spotify (hero + horizontal carousels) · Duolingo (progresso + 1 main CTA) · D&D Beyond (hero char card + actions).

```
┌──────────────────────────────────────┐
│ 🌒 JSGAME · D&D Online · 30min       │ ← 56px hero
├──────────────────────────────────────┤
│ 👤 João · 🌟 Streak 3d · ✗ offline   │ ← 40px identity bar (sticky)
├──────────────────────────────────────┤
│                                      │
│ ━━━ CONTINUE DE ONDE PAROU ━━━━━     │ ← só se tem session
│ ┌──────────────────────────────────┐ │
│ │ Beco sem saída · sessão 2 ·     │ │
│ │ Aelar Punhocerto · HP 10/10     │ │
│ │ "A patrulha alcançou..."         │ │ ← ι.2 preview
│ │  [▶ CONTINUAR]                   │ │ ← CTA pulsing gold
│ └──────────────────────────────────┘ │
│                                      │
│ ━━━ ⚔ JOGAR JÁ (PJS PRONTOS) ━━━    │
│ ┌────┐ ┌────┐ ┌────┐                │
│ │🪨  │ │🌟  │ │🗡  │                │ ← prefabs 100x140
│ │Bor.│ │Lyr.│ │Sin.│                │
│ │▶JOG│ │▶JOG│ │▶JOG│                │
│ └────┘ └────┘ └────┘                │
│  ✎ Criar PJ do zero (Wizard)        │ ← link discreto
│                                      │
│ ━━━ 🤝 COOP ━━━━━━━━━━━━━━━━━━━     │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ 🏛 LOBBY     │ │ 🔗 JOINAR    │   │ ← 2 botões iguais
│ └──────────────┘ └──────────────┘   │
│                                      │
│ ━━━ 📚 MEUS PJs (3)         ▼ ━━    │ ← collapsible
│ ━━━ 🏆 CONQUISTAS           ▼ ━━    │
│ ━━━ 💀 CEMITÉRIO            ▼ ━━    │
│ ━━━ ✨ HIGHLIGHTS           ▼ ━━    │
│                                      │
│ ━━━ Login · Perfil · ⚙ ━━━━━━━━━    │ ← footer 40px
└──────────────────────────────────────┘
```

#### Ω.2.c — Componente Collapsible Section (~1h)

Reusável pra "Meus PJs", "Crônicas", "Cemitério", "Highlights":

```ts
// home/sections/collapsible-list.ts
export interface CollapsibleSectionOpts {
  id: string;
  title: string;
  icon: string;
  count?: number;          // mostra "(N)" no header
  badge?: string;          // ex: "⚠ vidas em risco"
  defaultOpen?: boolean;
  renderContent: () => HTMLElement;
}
```

Visual:
- Header 56px com glyph + título + count + chevron ▼/▲
- Tap expand/collapse com animação 200ms (height transition)
- localStorage `home.section.{id}.collapsed` persiste estado
- Lazy render: renderContent só chamado no primeiro expand

#### Ω.2.d — Hero compacto + Identity bar (~1h)

`hero.ts` (56px):
- Logo "JSGAME" font-family Cinzel
- Tagline curta "D&D Online · Mestre IA · 30min"
- Sem chips de status (movidos pro identity bar)

`identity-bar.ts` (40px sticky):
- Avatar emoji por raça/classe do PJ ativo OU 👤 anônimo
- Nome do owner (input inline editável discreto)
- Streak count + servidor status + IA status (tudo compacto numa linha)
- Tap no avatar → abre perfil/login

#### Ω.2.e — Continue Card destaque (~1h)

`continue-card.ts`:
- Só renderiza se `lastSession` existir + crônica está ativa
- Card grande 140-160px com:
  - Title: nome crônica
  - Meta: sessão N · location · PJ ativo
  - Preview: última narração 140 chars (ι.2 já implementado)
  - Badge "⚠ vidas em risco" se HP baixo (ι.5)
  - CTA grande "▶ CONTINUAR" com pulse animation (cta-glow)
- Tap → navigate campaign

Esta é a feature mais clicada — merece destaque #1 acima das prefabs.

#### Ω.2.f — Play Now refino (~30min)

`play-now.ts`:
- Layout grid 3 colunas (mobile) ou 3 inline (desktop)
- Cards 100×140 com glyph grande + nome + 1 linha desc
- "▶ JOGAR" CTA gold no fundo do card
- Hover/active states já existem (prefab-cards.css)
- Link "✎ Criar PJ do zero" abaixo, discreto

#### Ω.2.g — Coop section (~30min)

`coop-section.ts`:
- 2 botões grid 50/50 em mobile / inline desktop
- Botão "🏛 CRIAR LOBBY" (gold)
- Botão "🔗 JOINAR LOBBY" + input código discreto abaixo (revelado on-focus)
- Link "↓ Joinar crônica em andamento" (collapsible com input ID)

#### Ω.2.h — Lists colapsáveis (~1h)

- `characters-list.ts`: Meus PJs (collapsible). Count, vidas em risco badge.
- `chronicles-list.ts`: Crônicas ativas (collapsible). Preview ι.2.
- `graveyard-link.ts`: Cemitério (collapsible com tombstones).
- `highlights-link.ts`: Highlights (collapsible com cards.

#### Ω.2.i — Footer minimal (~30min)

- Login button (se anon)
- Perfil link (se logado)
- ⚙ link UX settings + 📖 glossário

#### Ω.2.j — CSS home-tavern.css (~1h)

- Substitui `home-core.css`
- Variáveis CSS: `--home-section-gap: 16px`, `--home-card-radius: 12px`
- Sections com `<section>` + `border-bottom` sutil
- Animações stagger entry (fade-in com delay incremental)
- prefers-reduced-motion respeitado
- Mobile portrait-narrow: padding mais agressivo, gaps menores

#### Ω.2.k — Tests (~1h)

- `home-screen.test.ts`: renderiza todas as seções
- `collapsible-list.test.ts`: expand/collapse + localStorage persist
- `continue-card.test.ts`: mostra/esconde baseado em lastSession
- `identity-bar.test.ts`: anônimo vs logado
- ~10-15 tests novos

#### Ω.2.l — Migração + cleanup (~30min)

- `renderHome` em `main.ts` → 1 linha: `new HomeScreen(container).start()`
- Remover seções antigas que ficaram no main.ts
- Remover home-core.css (substituído)
- Verificar nenhuma regressão em `prefab-cards.css`, `home-coop.css`, `home-camp-card-enriched.css`

---

### Ω.3 (opcional, ~1h) — Cache bust + diagnostic

- Vite config: hash forçado no nome dos assets (cache busting)
- Endpoint `/api/diagnostic/client-info` retorna versão atual
- Banner topo se versão local < versão prod ("⟳ Atualização disponível — toque pra recarregar")
- Service worker (se PWA virar real): forced cache invalidation

---

## 4. Cronograma estimado

| Sprint | Tempo | Commits batched |
|---|---|---|
| Ω.1 Dado DEFINITIVO | ~3h | 2 commits (force-motion + robustness/watchdog/tests) |
| Ω.2 Home Tavern | ~6-8h | 4-5 commits batched (arquitetura, components, lists, migration) |
| Ω.3 Cache bust opcional | ~1h | 1 commit |
| **Total** | **~10-12h** | **7-8 commits** |

## 5. Ordem recomendada de execução

1. **Ω.1 primeiro** (3h): força dado a aparecer ANTES de mexer em home. Confirma com playtest. Se resolver, segue. Se não, investiga mais (logs prod, diagnostic mode).
2. **Ω.2 depois** (6-8h): refactor home em paralelo de seções.
3. **Ω.3 só se necessário** (~1h): cache bust se Render servir asset antigo.

## 6. Arquivos a tocar

### Ω.1 (dice override)
- `src/client/ux-prefs.ts` — campo `forceMotion: boolean`
- `src/client/ux-settings-modal.ts` — toggle "Forçar animações"
- `src/client/styles/dice.css` — body.force-motion overrides com !important
- `src/client/styles/_polish.css` (ou ux-settings.css) — body.force-motion class
- `src/client/dice/dice-3d.ts` — `prefersReducedMotion()` honra force-motion
- `src/client/dice/dice-3d.ts` — `rollAndReveal()` robustez + watchdog
- `src/client/campaign/skill-check-overlay.ts` — watchdog timer
- `src/server/routes/api.ts` — endpoint `/api/diagnostic/dice` (opcional)
- `src/client/dice/__tests__/dice-3d.test.ts` — tests force-motion override
- `src/client/__tests__/ux-prefs.test.ts` — toggle forceMotion

### Ω.2 (home tavern)
- `src/client/home/home-screen.ts` NOVO
- `src/client/home/sections/*.ts` NOVOS (9 arquivos)
- `src/client/styles/home-tavern.css` NOVO
- `src/client/main.ts` — `renderHome` reduzido pra 1 chamada de `HomeScreen`
- `src/client/styles.css` — remover home-core.css, add home-tavern.css
- `src/client/styles/home-core.css` DELETE (ou marcar deprecated)
- `src/client/home/__tests__/*.test.ts` NOVOS

## 7. Risk register

| Risco | Mitigação |
|---|---|
| Ω.1.a !important em CSS gera conflito com tests existentes | Tests checam className, não computed style — risco baixo |
| Ω.1.c fallback dramático em reduced-motion viola intenção do usuário | Default ON do force-motion mas user pode desativar (vence prefere reduce) |
| Ω.2 refactor home pode quebrar fluxos existentes (lobby, wizard, sheet) | Migration cautelosa: home-screen.ts inicialmente APPENDS, depois remove main.ts renderHome |
| Ω.2 prefab-cards.css + lobby-personality-preview.css interagem com novos componentes | Audit selectors antes de renomear |
| Tests singleFork + localStorage mock issues (igual κ.1) | Usar `vi.stubGlobal('localStorage', mockStorage)` pattern já estabelecido |

## 8. Tests-alvo

- Antes: **1431 tests**
- Pós Ω.1: ~1436 tests (+5 dice/ux)
- Pós Ω.2: ~1450 tests (+15 home)
- Pós Ω.3: ~1452 tests (+2 cache)

## 9. Decisões pendentes (D1-D3)

### D1 — Default do `forceMotion`?
- **ON**: maioria dos players vê animação dramática. Quebra preference do OS pra ~5% que tem reduced-motion ativo.
- OFF: respeita OS. Player precisa descobrir setting pra ver animação.
- **Recomendação**: **ON** + label "Animações cinematográficas" explicando. Player com epilepsia/sensibilidade ativa "respeitar OS" depois.

### D2 — Continue Card é #1 ou #2 na home?
- **#1 acima de Play Now**: ROI alto, retorno é o caso comum.
- #2 abaixo: foco em new player onboarding.
- **Recomendação**: **#1** quando existe lastSession. Sem lastSession, prefabs viram #1.

### D3 — Mantém botão "Personagem Customizado (Wizard)" visível ou esconde sob collapsible?
- Visível: descobrabilidade pra power users.
- Sob "Mais opções": home mais limpa, casual majority.
- **Recomendação**: link discreto **abaixo dos prefabs** ("✎ Criar PJ do zero — Wizard"). Não card, não botão grande. Compromisso.

## 10. O que NÃO está no plano

- ~~PWA install banner~~ — fora de escopo
- ~~i18n EN~~ — pt-BR-only
- ~~Sound mixer settings~~ — já existe em UX settings
- ~~Dashboard analytics em tempo real~~ — métricas via curl funciona
- ~~Refactor combat screen~~ — está OK pós Sprint ψ

## 11. Validação pós-Sprint Ω

Playtest checklist mobile real:
- [ ] Skill check em exploração: dado cai do alto, gira, revela número (drop-in + 1500ms + bounce visível)
- [ ] Death save (HP 0): dado dramático aparece com verdict "✓/✗" ou "Volta da Morte!" no nat 20
- [ ] Save throw: idem ao skill check
- [ ] UX Settings: toggle "Animações cinematográficas" muda comportamento (off = respeita OS)
- [ ] Home: hero compacto + identity bar + continue card grande (se aplicável) + prefabs + coop + collapsibles
- [ ] Collapsibles: expand/collapse smooth, estado persiste reload
- [ ] Performance: home renderiza em < 200ms, sem layout shift

## 12. 🎯 Próxima conversa — execução autônoma

**Recomendação**: execute Sprint Ω inteiro autônomo (~10-12h), commits batched conforme cronograma. Push origin/main após cada commit. CLAUDE.md + HANDOFF final ao terminar.

**Decisões D1-D3 já confirmadas nas recomendações** — não precisa perguntar.

Sequência:
1. Ω.1 (dado fix DEFINITIVO) — 2 commits, ~3h
2. Validar deploy + playtest dado em prod (~10min de espera)
3. Ω.2 (home tavern) — 4-5 commits batched, ~6-8h
4. Ω.3 opcional se cache problemático
5. CLAUDE.md + HANDOFF_done.md ao final

Tests + typecheck OK em cada commit. Zero regressão.
