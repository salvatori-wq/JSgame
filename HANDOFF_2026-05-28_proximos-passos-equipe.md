# Handoff — Próximos passos da equipe (A/B/C) — entregue

> **Data**: 2026-05-28 · **3 commits feature + 1 commit docs** · **1559→1576 tests verde (+17)** · **deploy auto-push (Render)**

## 1. Contexto

João pediu "segue os próximos passos" do handoff anterior. Os 4 sugeridos eram:
1. Audit do Wizard (5 steps)
2. Audit do combat-screen mobile
3. Mensagem de erro coop (family-friendly)
4. Tela cold-open primeira sessão (moment of truth)

Decisão executiva: agrupar em **3 sub-sprints temáticos** (A/B/C) com mesma
equipe das 4 personas (Mariana DM / Tiago mobile / Beatriz UX / Henrique família).

## 2. Equipe de personas (reutilizada)

| Persona | Foco |
|---|---|
| **Mariana** | Terminologia PHB, fidelidade às regras |
| **Tiago** | Hit targets, polegar mobile |
| **Beatriz** | Hierarquia visual, contraste |
| **Henrique** | Microcopy family-friendly, primeira impressão |

## 3. Commits

```
203e583 feat(C): polish coop errors + cold-open dramatic — humanize-error + first-narration
66dd5dd feat(B): polish combat — hit targets + 'Atacar' primary + Disparada→Disparar
30bcaa0 feat(A): polish wizard — hit targets + microcopy didática + tooltips progresso
<este>  docs: HANDOFF próximos passos da equipe + CLAUDE.md atualizado
```

## 4. Sub-sprint A — Wizard (5 steps) [`30bcaa0`]

### Achados
- Tiago: cancel btn 16px, randomizar 36px, wp-step mobile 32px (todos <40 hit)
- Beatriz: 8 progress steps em mobile só com número (label hidden) sem contexto
- Mariana: terminologia PT-BR mas distância em "ft" só, sem metros
- Henrique: "Nv 4" jargão obscuro pra novatos; intro do point buy técnica demais

### Correções
**Hit targets**:
- `.wiz-randomize-btn` 36→44px
- `.wiz-back-btn` (Cancelar header) → padding 10/12 + min-height 44px
- `.wp-step` mobile 32→40px

**Microcopy didático**:
- Label step 7 "Nv 4" → "Talento" (Henrique entende, Mariana sabe a regra)
- Step Atributos intro denso → lead + 3 bullets visuais (◆):
  - "Compre seus 27 pontos (regra 'Point Buy' do PHB)"
  - "Cada atributo começa em 8 (grátis). Limite: 15 antes dos bônus raciais."
  - "Score 9–13 → 1pt. Score 14–15 → 2pts."
  - "Sem pressa? Use 🎲 Randomizar tudo no topo"

**Acessibilidade**:
- 8 progress steps com tooltip + aria-label completos:
  - "Passo 1 de 8: Raça — Escolha a raça do herói (bônus de atributo + traços)"
  - "Passo 4 de 8: Atributos — Distribua 27 pontos entre os 6 atributos"
  - Etc. Funciona mesmo com label visual oculto em portrait-narrow.

**PT-BR métrica**:
- Race cards: "⊳ 30 ft" → "⊳ 9m" + tooltip "Deslocamento por turno (1 quadrado = 1.5m)"
- Darkvision "60 ft" → "18m"

## 5. Sub-sprint B — Combat mobile [`66dd5dd`]

### Achados
- Tiago: cb-action-btn altura ~46px (variável por content) — borderline
- Beatriz: 9 botões de ação flat sem hierarquia — Atacar é 90% dos turnos
- Mariana: "Disparada" não é PHB PT-BR (verbo certo = "Disparar")
- Henrique: hints técnicos sem explicação mecânica

### Correções
**Hit targets**:
- `.cb-action-btn` min-height: 50px garantido

**Hierarquia ações (Beatriz)**:
- "Atacar" ganha classe `.is-primary` com:
  - Border dourado mais saturado
  - Glow sutil vermelho interno
  - Hover: accent-blood + 14px glow
- Destaque visual da ação mais comum (90%+ dos turnos)
- Outras 8 ações secundárias mesma hierarquia entre si

**Terminologia PHB (Mariana)**:
- "Disparada" → "Disparar" em 4 arquivos:
  - combat-screen.ts, action-dock-topics.ts, combat-tutorial.ts, glossary.ts
- Glossary Movimento: "30ft" → "9m / 30ft" (PT-BR primeiro)

**Hints didáticos (Mariana/Henrique)**:
- Atacar: "Selecione o inimigo alvo nos cards acima"
- Esquivar: "...desvantagem até seu próximo turno"
- Esconder: "Teste de Furtividade — se ninguém te vê, fica oculto"
- Agarrar: "Atletismo vs Atletismo/Acrobacia — alvo fica preso"

## 6. Sub-sprint C — Coop errors + cold-open dramático [`203e583`]

### Achados
- Henrique: erros do servidor expostos crus ("500 Internal Server Error",
  "TypeError: Cannot read property…") são assustadores
- Henrique: primeira narração da sessão é o "moment of truth" da primeira
  impressão — deveria ter peso visual dramático

### Correções
**humanize-error helper (Henrique)**:
- `src/client/humanize-error.ts` NOVO — função pura que traduz erros técnicos
  em mensagens family-friendly
- 9 padrões cobertos:
  - ⌛ Timeout do Mestre
  - 🧠 Provider LLM falhou (Groq/Gemini/Anthropic/Mistral)
  - 🌙 Todos providers indisponíveis
  - 📡 Erro de rede / ECONNREFUSED
  - 🌙 500 Internal Server Error
  - 🌙 503 Service Unavailable
  - ⏳ Not your turn
  - 🎯 Invalid target
  - ⛔ Already used
  - 💾 SQLITE_BUSY / database locked
  - 🚪 Lobby closed / not found
  - 👥 Lobby full
- Heurística fallback: msgs curtas amigáveis passam direto; longas técnicas
  caem em "🌙 Algo se atrapalhou aqui."
- Wire em `campaign-screen.ts` onError: `toastError(humanizeServerError(msg))`

**Cold-open dramático (Henrique)**:
- `NarrationLog.appendNarration`: primeira entry da sessão ganha classe
  `.is-first-narration` (filtro por `entries.filter(kind=narration).length === 0`)
- CSS keyframe `narr-first-reveal` 1.4s cubic-bezier:
  - 0%: opacity 0, translateY 20px, scale 0.96
  - 40%: opacity 1, glow dourado 28px box-shadow
  - 100%: identidade visual
- Border-left 3→4px + shadow inset dourado
- `.cnn-speaker` gold + text-shadow no first
- `prefers-reduced-motion`: degrada pra narr-fade-in 400ms normal

## 7. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes A | 1559 | OK |
| Depois A | 1559 (microcopy/CSS, sem novos) | OK |
| Depois B | 1559 (microcopy/CSS, sem novos) | OK |
| Depois C | 1576 (+14 humanize + 3 first-narration) | OK |

**+17 tests novos. Zero regressão.**

## 8. Validação visual

Tudo validado via preview_eval em viewport mobile 375×812 (sem chamar LLM):
- Sub-sprint A: hit targets ≥44, archetypes PHB, "Talento" label, tooltips
- Sub-sprint B: action btn 50px, "Atacar" .is-primary, "Disparar" microcopy
- Sub-sprint C: humanize-error patterns + first-narration class via tests

## 9. Decisões executivas tomadas

- ✓ Mantive 8 steps do wizard (race/class/subclass/abilities/background/
  personality/talento/review) — não consolidei. CLAUDE.md menciona "5 steps"
  mas é estado antigo; já cresceu naturalmente.
- ✓ Não toquei nos cold-open templates do servidor (já reescritos em Ω.8)
- ✓ Não mexi no duolingo tutorial dentro de combate (escopo era home/wizard/
  combat-screen polish, não tutoriais)
- ✓ Zero LLM calls (Groq/Gemini não invocados — pura inspeção UI estática)
- ✓ Foco em decisões EXECUTIVAS (feedback persistente João)

## 10. Próximos passos sugeridos

Ainda valem polish numa próxima sessão:

1. **Audit do step-personality (PHB cap 4)** — Mariana iria comentar sobre as
   13 backgrounds × 26 strings (338 entries) com filtros e ordenação
2. **Multiclass modal** — feature avançada PHB cap 6, audit com Mariana
3. **Spell book modal completo** — ainda usa lista simples, poderia usar
   o SpellCard component novo (Φ.3) em modal full-screen
4. **Achievements modal mobile** — ver se hierarquia visual fica boa em 375px
5. **Lobby personality picker** — auditar com Mariana sobre tom DM
6. **Live preview do wizard** — atualizar conforme escolhas (já tem mas pode
   ganhar polish visual)

## 11. Como começar próxima sessão

```
Vou continuar o JSgame. Working tree limpo, 1576 tests verde, deploy em prod
(jsgame-drpe.onrender.com). Sub-sprints A/B/C entregues (wizard + combat
mobile + coop errors + cold-open dramático).

[escolha 1]
- Audit step-personality (PHB cap 4) com Mariana
- Audit multiclass modal com Mariana
- Spell book modal full-screen usando SpellCard (Φ.3)
- Audit achievements modal mobile com Beatriz
- Outro: ___
```

## 12. Estado final

```bash
$ git log --oneline | head -8
<este> docs: HANDOFF próximos passos da equipe + CLAUDE.md
203e583 feat(C): polish coop errors + cold-open dramatic — humanize-error + first-narration
66dd5dd feat(B): polish combat — hit targets + 'Atacar' primary + Disparada→Disparar
30bcaa0 feat(A): polish wizard — hit targets + microcopy didática + tooltips progresso
11b7cd3 feat(R3+docs): refino final 3-rounds polish — boot/onboarding/joinar + handoff
8c07304 feat(R2): polish hierarquia — hero leaner + footer maior + prefab denso + cópia
11c1efb feat(R1): polish home — hit targets + cópia D&D + resilience erro 500
f5415d8 docs(Φ.6): handoff Sprint Φ done + CLAUDE.md atualizado
```

Tests: **1576 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
