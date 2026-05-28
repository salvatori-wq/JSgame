# Handoff — 3 Rounds Polish "Audit Equipe 4 Personas" — entregue

> **Data**: 2026-05-28 · **3 commits feature + 1 commit handoff** · **1559 tests verde mantido** · **deploy auto-push (Render)**

## 1. Contexto

João pediu: rodar testes no jogo focando em **polish + jogabilidade + disposição dos botões**,
formar **equipe de 4 personas** que façam sentido pra comentar, e **3 rounds de correções
com profundidade e assertividade** sem gastar muitos créditos (foco em UI estática, sem
chamar LLM real).

## 2. Equipe de personas (4)

| Persona | Perfil | Foco |
|---|---|---|
| **Mariana** | DM 10+ anos D&D 5e oficial | Fidelidade às regras PHB/DMG, terminologia |
| **Tiago** | Gamer mobile casual, 15-30min/sessão | Hit targets, polegar, fricção mobile |
| **Beatriz** | UX designer sênior | Hierarquia visual, contraste, espaçamento |
| **Henrique** | Pai 35a + filho 12a | Primeira impressão, onboarding, palavras family-friendly |

## 3. Audit findings consolidados

**Achados via preview_eval (375×812 mobile):**

| ID | Persona | Issue | Severidade |
|---|---|---|---|
| 1 | Tiago | Botão "Entrar" 32px altura (texto 18px visível) — abaixo de 40px hit | 🔴 Crítico |
| 2 | Tiago | Input nome 30px altura — abaixo de 40px | 🔴 Crítico |
| 3 | Tiago | Toggle "↓ Joinar crônica" 32px | 🟡 Médio |
| 4 | Mariana | "TANK · BATE FORTE" gamer-speak, não PHB | 🔴 Crítico |
| 5 | Mariana | "Trapaceira halfling" mistura classe+raça | 🔴 Crítico |
| 6 | Mariana | "Arquivista alta-elfa" não é classe 5e | 🔴 Crítico |
| 7 | Mariana | "Mestre IA" abstrato vs "IA narra a história" | 🟡 Médio |
| 8 | Mariana | "Carregando o multiverso" Marvel-speak, não D&D | 🟡 Médio |
| 9 | Beatriz | 4 elementos competindo no hero | 🟡 Médio |
| 10 | Beatriz | Input + botão não parecem par conectado | 🟡 Médio |
| 11 | Beatriz | Footer glyph 22 + label 11 apertado | 🟡 Médio |
| 12 | Beatriz | "TELA" footer label vago | 🟡 Médio |
| 13 | Beatriz | Prefab cards 155px altura, 3 cards = 465px (~57% mobile fold) | 🟢 Polish |
| 14 | Henrique | Erro "500 Internal Server Error" exposto ao usuário | 🔴 Crítico |
| 15 | Henrique | Palavra "Cemitério" desconfortável pra família | 🟡 Médio |
| 16 | Henrique | "Lobby" jargão gamer | 🟡 Médio |
| 17 | Henrique | Não claro que dá pra jogar sem cadastro | 🔴 Crítico |
| 18 | Henrique | "Joinar" anglicismo em vários botões | 🟢 Polish |

## 4. Commits dos 3 rounds

```
8c07304 feat(R2): polish hierarquia — hero leaner + footer maior + prefab denso + cópia
11c1efb feat(R1): polish home — hit targets + cópia D&D + resilience erro 500
<este>  feat(R3): refino final — boot splash + onboarding + joinar remanescentes
```

## 5. O que mudou em cada round

### Round 1 — Críticos UX (`11c1efb`)

**Hit targets (Tiago) — 32→44px (WCAG AAA polegar)**:
- `.home-id-owner-input` 30→44px (font 14→15, padding 6→10)
- `.home-id-btn` 32→44px (font 12→13, white-space nowrap)
- `.home-coop-advanced-toggle` 32→40px

**Microcopy D&D PHB (Mariana)** — archetypes em terminologia oficial:
- Borin: "Tank · Bate forte" → "Lutador Anão · Linha de frente"
- Lyra: "Caster · Magia" → "Maga Alta-elfa · Mistérios arcanos"
- Sina: "Skirmisher · Rápida" → "Ladina Halfling · Ataque furtivo"
- Teasers reescritos com mecânica D&D real ("Dois golpes por turno", "Acerto crítico ao surpreender")

**Family-friendly (Henrique)** — wording menos macabro/jargão:
- "Cemitério 💀" → "Heróis Caídos 🪦"
- "Joinar Lobby" → "Entrar na Sala"
- "Criar Lobby" → "Criar Sala"
- "Código do lobby" → "Código da sala"
- "PJs e cemitério aparecem aqui" → "seus heróis aparecem aqui"
- "Sorte ou medo?" → "Mantenha-os vivos."

**Resilience backend down (Henrique)**:
- Substituído "Erro listando crônicas: 500 Internal Server Error" exposto por
  mensagem amigável "🌙 Não consegui falar com o servidor. Tente abrir de novo em alguns segundos."
- Detecta error string (500/networkerror/failed to fetch) e usa empty state normal
  quando lista realmente vazia

**Identity bar**:
- "Entrar" → "Login" + tooltip "Salvar progresso entre dispositivos (opcional)"
- Placeholder input: "Digite seu nome e jogue agora" + aria-label complementar

### Round 2 — Hierarquia + jogabilidade (`8c07304`)

**Hero leaner (Beatriz)**:
- Título 26→22px (peso visual reduzido)
- Tagline concreta: "D&D 5e · IA narra a história · sessões de 30min · até 3 amigos"
- Chips status 10→9px + opacity 0.85 (discreto, não competitivo)
- Chips text: "● online / 🧠 gemini" → "● on / 🧠 ok" (provider em tooltip)

**Identity bar coesa**:
- Avatar 30→36px (alinha com input/btn 44px)
- Padding 8/12 → 6/10 mais compacto vertical
- Gap 10→8 — input + login agora "par" visual

**Footer maior (Beatriz/Tiago)**:
- Glyph 20→24px
- Label 9→11px UPPERCASE com letter-spacing
- Hit area 50→58px (gap 2→4, padding 8→10)
- "Tela" → "Ajustes"
- "Entrar" → "Login" (consistente com header)

**Prefab cards densos**:
- Padding 14→10, gap 14→10, min-height 88→64
- Icon 44→32px (grid-row 1/-1, não força row 1 a 50px)
- Archetype line-height 1.2 (reduz row 26→24)
- Teaser 2-line clamp → 1-line
- **Card altura: 155→136px (~12% mais denso)**

**Coop wording**:
- "↓ Joinar crônica em andamento (com ID)" → "↓ Tenho o ID de uma crônica antiga"
- "Cole o ID da crônica" → "Cole o ID longo da crônica aqui"
- "Joinar Crônica" → "Entrar na Crônica"

### Round 3 — Refino final (`<este commit>`)

**Boot splash (Mariana)**:
- "Carregando o multiverso…" → "Convocando o Mestre…" (D&D, não Marvel)

**Onboarding tour (Mariana/Henrique)**:
- "Bem-vindo a JSgame" → "Bem-vindo à mesa" (linguagem de mesa)
- Texto técnico ("Wizard de 5 passos: raça, classe…") → narrativo
- "Crie um PJ" → "Crie um herói"
- "cemitério" → "caídos" no contexto de progresso persistente
- Adicionado "magic link" explicitamente pra clareza de método

**Joinar remanescentes**:
- "🤝 Joinar" no card de crônica → "🤝 Entrar"
- Toast share campaign ID: "Cole no Home → Joinar." → "Cole no Home → Tenho o ID de uma crônica."

## 6. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes do audit | 1559 | OK |
| Depois R1 | 1558 (1 ajustado: Entrar→Login) | OK |
| Depois R2 | 1559 | OK |
| Depois R3 | 1559 | OK |

Zero regressão. Único test ajustado: `identity-bar.test.ts` esperava "Entrar" agora "Login".

## 7. Validação visual

Todas mudanças validadas via `preview_eval`:

```js
// Antes
{ input.h: 30, loginBtn.h: 32, advToggle.h: 32 }

// Depois R1
{ input.h: 44, loginBtn.h: 44, advToggle.h: 40 }

// Hierarquia R2
{ heroTitle: 26→22, footer.h: 50→60, prefabCard: 155→136 }

// Cópia R3
{ bootTagline: "Convocando o Mestre…",
  heroTagline: "D&D 5e · IA narra a história · sessões de 30min · até 3 amigos",
  prefabArchetypes: ["Lutador Anão · Linha de frente", ...],
  coopBtns: ["Criar Sala", "Entrar na Sala"],
  footerLabels: ["Login", "Glossário", "Ajustes"] }
```

## 8. Decisões executivas tomadas

- ⚠ **Não mexi no duolingo-tutorial.ts** dentro de campanha — escopo era home/onboarding,
  e mexer ali quebraria test snapshot existente (de 2026-05-27)
- ⚠ **Não testei wizard/combat/campaign** com personas — escopo eram telas iniciais
  (home + onboarding) onde a fricção da primeira impressão concentra
- ✓ Mantive classes legacy CSS pra zero risco de regressão (ic-card adicionado, mas
  inv-item-card permanece)
- ✓ Foco em decisões EXECUTIVAS (feedback persistente João: "não perguntar muito")
- ✓ Zero chamada LLM real (Groq/Gemini não invocados — só preview UI estática)

## 9. Próximos passos sugeridos

Áreas que ainda valem polish numa sessão futura:

1. **Audit do Wizard (5 steps)** — Mariana e Henrique iriam comentar muito sobre
   point buy 27 (jargão técnico), e sobre passos longos sem progresso visual claro
2. **Audit do campaign-screen mobile** — Tiago e Beatriz sobre a barra de ações,
   inventory drawer, combat screen mobile (apesar de Sprint π/Ω ter mexido muito)
3. **Mensagem de erro coop** — quando sala fecha ou amigo desconecta, mensagens
   amigáveis (família-friendly)
4. **Tela cold-open primeira sessão** — primeiro contato com narração da IA
   é o "moment of truth" — Henrique e o filho viriam aqui

## 10. Como começar próxima sessão

```
Vou continuar o JSgame. Working tree limpo, 1559 tests verde, deploy em prod
(jsgame-drpe.onrender.com). Tres rounds de polish entregues após audit de 4 personas.

[escolha 1]
- Audit do Wizard (5 steps) com Mariana e Henrique
- Audit do combat-screen mobile com Tiago e Beatriz
- Audit do cold-open primeira sessão (Henrique + filho 12a)
- Outro: ___
```

## 11. Estado final

```bash
$ git log --oneline | head -8
<este> feat(R3): refino final + handoff
8c07304 feat(R2): polish hierarquia — hero leaner + footer maior + prefab denso + cópia
11c1efb feat(R1): polish home — hit targets + cópia D&D + resilience erro 500
f5415d8 docs(Φ.6): handoff Sprint Φ done + CLAUDE.md atualizado
de05968 feat(Φ.5): tipografia D&D autêntica — Cinzel + Cardo via Google Fonts
f6c4b12 feat(Φ.4): ItemCard com rarity glow oficial DMG + atunement badge
32cdd4c feat(Φ.3): SpellCard com cores oficiais por escola D&D 5e
88aaf2f feat(Φ.2): StatBlock component D&D 5e autêntico — NPCs + combat enemies
```

Tests: **1559 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
