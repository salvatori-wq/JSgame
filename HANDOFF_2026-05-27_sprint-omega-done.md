# Handoff — Sprint Ω (Polimento Definitivo) — ENTREGUE

## 1. Resumo executivo

**Sprint Ω entregue em 3 commits, 1431→1455 tests (+24 novos), zero regressão.** Todos pushed para `origin/main`. Render auto-deploy disparado.

| Commit | Sprint | Tests | Linhas |
|---|---|---|---|
| `37876d0` | Ω.1 Dado DEFINITIVO | +7 | +266 / -28 |
| `1c9bb5b` | Ω.2.a Home Tavern arquitetura | (mesmo) | +1659 / -506 |
| `0e8c08d` | Ω.2.b Home Tavern tests | +17 | +384 / 0 |

Working tree limpo. Plan executado autônomo end-to-end conforme D1-D3 confirmadas.

```
git log --oneline | head -6
0e8c08d test(polish-Ω.2.b): tests pra home tavern — collapsible + identity-bar + continue-card (+17)
1c9bb5b feat(polish-Ω.2.a): home tavern refactor — renderHome 250L → 9 sections em src/client/home/
37876d0 feat(polish-Ω.1): dado DEFINITIVO — forceMotion override + watchdog 5s + robustez rollAndReveal
7f7d4d0 docs: plano Sprint Ω profundo — dado DEFINITIVO + home tavern reorganizada
5f38a83 fix(polish-ψ-deep): 4 fixes pós-audit profundo
c433ebc fix(polish-ψ): dado skill-check visível + chat scroll preservado
```

## 2. Ω.1 — Dado DEFINITIVO (commit `37876d0`)

### Hipótese principal validada e fixada
**Suspeita #1 do plano**: João tem `prefers-reduced-motion: reduce` ativo (Android Settings → Acessibilidade → "Remover animações" — pattern comum em mobile com bateria baixa ou apps antigos). Reduce dispara `dieReducedFade` 200ms quase invisível.

### Fix end-to-end

#### A. UX pref `forceMotion` (default ON)
```ts
// src/client/ux-prefs.ts
export interface UxPrefs {
  // ...
  forceMotion: boolean;  // default true
}
// applyUxPrefs adiciona body.force-motion class quando ativo
document.body.classList.toggle('force-motion', prefs.forceMotion);
```

#### B. CSS overrides com `!important`
```css
/* src/client/styles/dice.css */
body.force-motion .die-3d.is-rolling {
  animation: dieRolling 1800ms cubic-bezier(0.16, 1, 0.3, 1) !important;
}
body.force-motion .sc-stage .die-3d.is-rolling {
  animation: dieRolling 1500ms cubic-bezier(0.16, 1, 0.3, 1) !important;
}
body.force-motion .die-3d.is-rolling .die-shadow {
  animation: dieShadowSync 1800ms cubic-bezier(0.16, 1, 0.3, 1) !important;
}
/* + crit/fumble/screen flash/overlay todos com !important */
```

#### C. `prefersReducedMotion()` honra force-motion
```ts
// src/client/dice/dice-3d.ts
export function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.body?.classList.contains('force-motion')) {
    return false;
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
```

#### D. Toggle no UX Settings Modal
```ts
// src/client/ux-settings-modal.ts
body.appendChild(renderToggle(
  '🎲 Animações cinematográficas',
  'Mostra dado caindo, girando e batendo mesmo se o sistema tiver "remover animações" ativo',
  prefs.forceMotion,
  (v) => { prefs = setUxPrefs({ forceMotion: v }); },
));
```

#### E. rollAndReveal robustez
- Re-query `.die-face` defensive (cria se foi removida do DOM)
- `void die.offsetWidth` força reflow antes de aplicar `is-rolling` → re-roll consecutivo re-anima
- `void face.offsetWidth` após `face.textContent = final` força repaint
- Telemetry hook opcional (`setDiceTelemetryHook(fn)`) com 4 eventos: `dice_roll_visual_started`, `dice_roll_visual_completed`, `dice_roll_visual_slow`, `dice_roll_face_missing`

#### F. Fallback dramático em reduced-motion
Antes: `dieReducedFade` opacity 0.5→1 em 200ms (player nem percebia).
Agora: `dieReducedReveal` scale 0.6→1.15→0.95→1 + opacity 0→1 em **600ms** com cubic-bezier overshoot (0.34, 1.56, 0.64, 1). Player ainda vê "aparece com peso".

#### G. Watchdog timers
```ts
// skill-check-overlay.ts — 5s
watchdogTimer = window.setTimeout(() => {
  handleWatchdogTimeout(rollBtn, inspBtn);
}, 5000);

// handleWatchdogTimeout:
rollBtn.textContent = '🎲 Tentar novamente';
showToast({ kind: 'warn', message: 'O Mestre demorou pra responder. Tente rolar de novo.' });
trackClientMetric('dice_roll_timeout', { kind: 'skill-check' });

// dice-roll-overlay.ts (combat) — 8s
// Mesma defesa pra combat rolls não ficarem órfãos
```

#### H. 2 métricas novas
- `dice_roll_timeout` — payload `{ kind: 'skill-check'|'combat' }`
- `dice_roll_visual_slow` — payload `{ elapsed_ms, expected_ms }`

Whitelist em `src/server/routes/api.ts` `CLIENT_ALLOWED_KINDS` + tipo `MetricsEventKind` em `src/server/metrics.ts` + tipo `trackClientMetric` em `src/client/api.ts`.

### Tests Ω.1 (+7)
- `forceMotion default true`
- `forceMotion ON adiciona body.force-motion`
- `forceMotion OFF remove body.force-motion`
- `forceMotion persiste em localStorage`
- `body.force-motion ignora prefers-reduced-motion`
- `telemetry hook dispara visual_started + completed`
- `re-query face defensive: cria face se foi removida do DOM`

Test ajustado: `respeita prefers-reduced-motion` agora espera 600ms (era 200ms).

## 3. Ω.2 — Home Tavern (commits `1c9bb5b` + `0e8c08d`)

### Problema
João: "menu inicial é uma confusão que só por deus! organize, inspire-se".

Estado anterior: `renderHome` (250+ linhas em `main.ts`) renderizava TUDO de uma vez:
hero + status chips + login bar + owner input + 3 prefabs + wizard button + lista PJs + coop + lista crônicas + cemitério + highlights. Hierarquia visual fraca.

### Refactor — arquitetura nova

```
src/client/home/
├── home-screen.ts             # orquestrador mountHomeScreen
├── sections/
│   ├── hero.ts                # logo + tagline + 2 chips status (compacto 56px)
│   ├── identity-bar.ts        # avatar + owner-input + streak + login/sair (sticky 40px)
│   ├── continue-card.ts       # CTA destaque #1 quando há lastSession
│   ├── play-now.ts            # 3 prefabs grandes + link discreto wizard
│   ├── coop.ts                # 2 botões 50/50 (criar/joinar) + advanced toggle
│   ├── collapsible.ts         # base reusável (localStorage persist)
│   ├── my-characters.ts       # collapsible "Meus PJs" (open default)
│   ├── my-chronicles.ts       # collapsible "Crônicas ativas" (preview ι.2 dentro)
│   ├── graveyard.ts           # collapsible "Cemitério" (logged-in only)
│   └── footer.ts              # Tela / Glossário / Perfil (links minimal)
└── __tests__/
    ├── collapsible.test.ts    (9 tests)
    ├── identity-bar.test.ts   (4 tests)
    └── continue-card.test.ts  (4 tests)

src/client/styles/home-tavern.css    # CSS novo
```

### Hierarquia visual nova
```
┌──────────────────────────────────────┐
│ 🌒 JSGAME · D&D · Mestre IA · 30min │ 56px hero
├──────────────────────────────────────┤
│ 👤 [owner-input] 🔥 3d 🏆 Sair       │ 40px identity bar (sticky top)
├──────────────────────────────────────┤
│ ━━━ CONTINUE DE ONDE PAROU ━━━━━     │ ← só se lastSession
│ ┌──────────────────────────────────┐ │
│ │ Beco sem saída · sessão 2        │ │
│ │ 📍 Taverna · ⚠ Borin em risco    │ │
│ │ "A patrulha alcançou..."          │ │ ← ι.2 preview
│ │  [▶ CONTINUAR]                    │ │ ← CTA cta-glow
│ └──────────────────────────────────┘ │
│ ━━━ ⚔ JOGAR JÁ ━━━━━━━━━━━━━━━━━     │
│ ┌────┐ ┌────┐ ┌────┐                │ ← 3 prefabs grid
│ │🪨  │ │🌟  │ │🗡  │                │
│ │Bor │ │Lyr │ │Sin │                │
│ │▶JOG│ │▶JOG│ │▶JOG│                │
│ └────┘ └────┘ └────┘                │
│  ✎ Criar PJ do zero (Wizard)        │ ← link discreto (D3)
│ ━━━ 🤝 COOP ━━━━━━━━━━━━━━━━━━━━     │
│ ┌──────────────┐ ┌──────────────┐   │ ← 2 botões 50/50
│ │ 🏛 Criar     │ │ 🔗 Joinar    │   │
│ │   Lobby      │ │   Lobby      │   │
│ └──────────────┘ └──────────────┘   │
│  ↓ Joinar crônica em andamento      │ ← advanced toggle
│ ━━━ 📚 Meus PJs (3)             ▲ ━ │ ← default OPEN
│   (lista PJs aqui)                   │
│ ━━━ 📖 Crônicas ativas (2)      ▼ ━ │ ← collapsible
│ ━━━ 💀 Cemitério                ▼ ━ │ ← collapsible (logged only)
│ ━━━━ ⚙ Tela · 📖 Gloss · 👤 ━━━━━━ │ ← footer minimal
└──────────────────────────────────────┘
```

### Componente collapsible base
- Header tap-toggle 48px com glyph + título + count + chevron animado
- Lazy renderContent (só chama na PRIMEIRA expansão)
- localStorage persist `home.section.{id}.collapsed`
- aria-expanded + aria-hidden corretos
- Animação max-height 280ms (transição), respeita prefers-reduced-motion

### Decisões D1-D3 confirmadas (do plano)
| Decisão | Implementação |
|---|---|
| **D1** forceMotion default ON | ✅ DEFAULT_PREFS.forceMotion = true |
| **D2** Continue Card #1 quando há lastSession | ✅ maybeRenderContinueCard retorna null sem session, ordem coloca antes do Play Now |
| **D3** Wizard como link discreto | ✅ `home-wizard-link` (border dashed, color faint, font 12px) abaixo do grid de prefabs |

### main.ts simplificado
```ts
async function renderHome(): Promise<void> {
  await mountHomeScreen({
    container: app!,
    currentUser,
    navigate,
    onLogout: async () => {
      currentUser = null;
      await render();
    },
  });
}
```

**-513 linhas no main.ts** (renderHome inline + helpers `renderTombstoneCard`, `renderCampaignCard`, `PREFAB_CARDS`, `renderPrefabSection`, `renderPrefabCard` movidos pra `home/`).

### Tests Ω.2 (+17)
- **collapsible (9):** render header, count badge, badge texto, defaultOpen carrega imediato, defaultOpen=false lazy, click expande/colapsa, localStorage persist, aria-expanded reflete, lazy render só dispara 1x
- **identity-bar (4):** "Entrar" anon, "Sair"+🏆 logado, owner-input debounce 200ms, focusOwnerInput is-needs-name + remove após 1800ms
- **continue-card (4):** null sem lastSession, skeleton inicial, CTA onContinue com IDs corretos, is-risk quando partyAnyAtRisk

## 4. Playtest local — validado

Subi backend + frontend via preview, validei via eval:

```js
{
  hero: true,              // ✅
  identity: true,          // ✅
  continue: false,         // ✅ (sem lastSession — esperado)
  playnow: true,           // ✅
  coop: true,              // ✅
  collapsibles: 2,         // ✅ (anônimo — sem cemitério)
  footer: true,            // ✅
  prefabCount: 3,          // ✅
  hasTitle: 'JSGAME',      // ✅
  hasOwnerInput: true,     // ✅
  hasForceMotion: true,    // ✅ Ω.1 ativo automático!
}
```

Collapsibles tested:
- "Meus PJs" default OPEN ✅
- "Crônicas" default closed ✅
- Click toggle → estado persiste em `home.section.my-chronicles.collapsed=false` ✅

Zero erros JS no console.

## 5. Estado final

- **1455 tests passando** (era 1431, +24 novos)
- **Typecheck OK**
- Working tree limpo
- 3 commits pushed origin/main
- Render auto-deploy disparado em curso

## 6. O que ficou de fora (escopo Ω opcional)

- **Ω.3 cache bust / service worker** — não bloqueava nada, deixei pra sessão futura se Render servir asset antigo
- **Endpoint `/api/diagnostic/dice`** — não foi necessário; toggle UX + watchdog já cobrem caso comum
- **HomeScreen unit tests do orquestrador** — coverage está nas seções individuais (3 tests files); orquestrador é só composição

## 7. Próximos passos sugeridos

### Validação produção (após Render deploy)
- [ ] Playtest mobile real com prefers-reduced-motion ativo (Android Settings → Acessibilidade → "Remover animações")
- [ ] Confirmar toggle "🎲 Animações cinematográficas" aparece em UX Settings
- [ ] Confirmar dado rola dramático com toggle ON mesmo com OS reduce ativo
- [ ] Confirmar layout home tavern em portrait-narrow (Android < 480px width)
- [ ] Verificar Continue Card aparece em retorno de sessão

### Métricas pós-deploy
- [ ] Em 24-48h: `curl /api/dm/ux-funnel?days=2` pra ver baseline
- [ ] Buscar eventos `dice_roll_timeout` pra ver se watchdog está disparando em prod
- [ ] Buscar eventos `dice_roll_visual_slow` pra detectar mobile mais lento

### Sprint futuro candidato
- **PWA install banner** — agora que home está organizada, faz sentido CTA "Adicionar à tela inicial"
- **Sound mixer settings** — pra granularidade fina (já existe wide toggle em UX Settings)
- **Service worker / asset versioning** — se Render servir cache antigo (Ω.3 do plano original)

## 8. Mensagem pro João

João, Sprint Ω entregue end-to-end conforme plano. Decisões D1-D3 aplicadas:

1. **Dado**: agora vai rolar dramático mesmo se você tem "Remover animações" ativo no Android. Toggle default ON, dá pra desativar em Tela & Preferências se quiser respeitar OS. Watchdog 5s evita "Rolando..." infinito — se trava, mostra "Tentar novamente".

2. **Home tavern**: refeita do zero com 9 seções. Hero compacto → Identity bar sticky → Continue Card destacado quando você tem sessão ativa → Play Now (3 prefabs) → Coop (2 botões grandes) → Collapsibles (Meus PJs aberto, resto fechado, persiste). Foi inspirada em Wash Me, Spotify, Duolingo, D&D Beyond. Mobile-first portrait-narrow tem padding/font/min-height específicos.

Deploy disparado. Quando subir em prod, valida no celular real e me fala como tá. Se ainda tiver problema de dado, é hora de hard refresh + investigar cache do browser/Service Worker.

— Claude
