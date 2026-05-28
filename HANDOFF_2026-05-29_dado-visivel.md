# Handoff — Sprint "Dado Visível" entregue + plano de melhoria

> **Data**: 2026-05-29 · **3 commits feature + 1 commit docs** · **1576→1591 tests verde (+15)** · **deploy auto-push (Render)**

## 1. Contexto

João reportou: *"toda vez que começa uma partida a gente joga um dado. depois não o vejo mais, meio sem nexo pra falar a verdade"*.

Audit profundo (com 2 chamadas LLM Gemini de verdade, ~12s cold-open + ~5s primeira rolagem) confirmou 3 causas raiz:
- **C1**: Chip "Observar arredores [Percepção]" visualmente idêntica às outras (sem ícone, sem cor)
- **C2**: Sem botão "🎲 Rolar dado" persistente no UI
- **C3**: Onboarding tutorial não menciona como rolar dado

3 sub-sprints (D1/D2/D3) endereçaram tudo. Validado novamente em preview real com 2 chamadas LLM.

## 2. Commits

```
96f860e feat(D3): onboarding tutorial + detector expandido — dado fica óbvio
3cb9d63 feat(D2): "🎲 Tentar" picker persistente — player toma iniciativa de rolar
b0f40eb feat(D1): chip-skill visível — ícone 🎲 + border dourado + badge destacado + hit 44
<este>  docs(D4): handoff sprint "Dado Visível" + plano de melhoria
```

## 3. O que foi entregue

### D1 — Chip-skill visível (b0f40eb)
**Antes:**
- `.cn-chip` 38px altura, border rgb(200,155,95), badge `.cn-chip-hint` italic 11px cinza
- "Observar arredores [Percepção]" indistinguível de "Falar com NPC"

**Depois:**
- `.cn-chip.is-skill` (auto-aplicada quando há hint):
  - Border dourado **#f4d07f** (validado em preview: `rgb(244, 208, 127)`)
  - Background gradient saturado, box-shadow inset gold
  - Hover: glow 14px gold + translateY(-1px)
- Ícone **🎲** prefix (`.cn-chip-dice`) com pulse 2.6s sutil (reduced-motion respeitado)
- Badge perícia agora pill dourada PT-BR maiúscula: "INVESTIGAÇÃO" em vez de "Investigação" italic
- Hit 38→**44px** (WCAG AAA polegar) — validado: `h: 44`
- Tooltip "🎲 Rola Investigação (d20 + bônus)"

### D2 — "🎲 Tentar" picker persistente (3cb9d63)
**Antes:**
- Dado só aparecia quando DM tool-call `set_pending_check` ou chip-skill clicada
- Player sem agência pra pedir "quero rolar Persuasão agora"

**Depois:**
- Novo topic **'dice'** no action-dock-topics (entre Magia e Mais)
- Click abre modal "🎲 Tentar algo — qual perícia?" com 18 perícias D&D 5e
- Ordem ergonômica: Percepção/Investigação/Persuasão/Atletismo/Furtividade/Enganação/Intuição/Atuação/Intimidação/Arcanismo primeiro
- Descrição com prefix atributo: "SAB · Notar presença, ouvir conversa baixa..."
- Player escolhe → server cria pending check com DC 12 default → overlay do dado abre normal
- Server-side: `Campaign.setPlayerInitiatedSkillCheck()` NÃO sobrescreve pending existente (Mestre prevalece)
- Picker validado em preview: modal renderiza com 18 perícias + descrições

### D3 — Onboarding + detector expandido (96f860e)
**Onboarding:**
- Step 4 NOVO no duolingo: "🎲 Como rolar o dado?"
  - Texto: *"Chips com 🎲 e badge dourado rolam d20. Sem chip à mão? Use o slot 🎲 Tentar no dock pra escolher qual perícia rolar."*
- Total steps: 6 → 7

**Detector γ.2 expandido (Mariana):**
- Percepção: + "cheirar o ar", "sentir [uma] presença", "me aproximo devagar", "toco com cuidado"
- Atletismo: + "empurro/empurro", "levanto o baú pesado" (com [úu]), "abro o baú com força" (abr\w+)
- DM detecta verbos comuns conjugados → pede skill check com mais frequência

## 4. Validação preview real

Final test (com Gemini LLM real, ~12s):

```
Cold-open → narração + .is-first-narration glow ✓
Roll d20 ("🎲 Rolar d20") → resultado ✓
DM resposta → 4 chips de ação:
  • "Falar com Borin"      ← chip normal
  • "Falar com Forjarocha" ← chip normal
  • "🎲 Investigar armadura [INVESTIGAÇÃO]" ← .is-skill, border #f4d07f, h=44, tooltip OK
  • "🎲 Investigar espada  [INVESTIGAÇÃO]" ← .is-skill, border #f4d07f, h=44, tooltip OK
Action Dock topics: ⚔ Combate · 🔍 Explorar · 🗣 Social · 🎲 Tentar · ⋯ Mais · ✎ Livre ✓
Click "🎲 Tentar" → modal "Tentar algo — qual perícia?" abre com 18 perícias ✓
```

## 5. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes D | 1576 | OK |
| Depois D1 | 1576 (CSS+JS only) | OK |
| Depois D2 | 1585 (+9: 6 picker + 3 server) | OK |
| Depois D3 | 1591 (+6: 6 detector patterns) | OK |

**+15 tests novos. Zero regressão.**

---

# 🎯 Plano de Melhoria — próxima sessão

Validei tudo via preview real. As 3 melhorias do dado funcionaram, mas observando o jogo de verdade percebo mais polish que vale fazer:

## Achados novos (post-sprint)

### 🔴 Crítico
**M1 — Action dock fica fora da viewport mobile (375×812)**:
- Cold-open + narração + chips + dock topics = **scroll necessário pra ver botões**
- Player precisa fazer scroll-down pra achar "🎲 Tentar"
- Fix: dock sticky-bottom ou colapsar narração após N segundos

**M2 — Skill-check overlay cobre toda viewport mas player não sabe que pode dispensar**:
- Cold-open força roll d20 — não tem opção "rolar depois" ou "pular este teste"
- Se Mariana quer ignorar a emboscada e seguir, não consegue
- Fix: botão sutil "Pular este teste" abaixo do "🎲 Rolar"

### 🟡 Médio
**M3 — Header truncado**:
- "🛤Estrada sob chuva fina · ❤13/13 · 0xp" comprimido em 1 linha 42px
- Em mobile narrow, "Estrada sob chuva fina" tem ellipsis "Estrada sob…"
- Fix: location em linha separada com truncate fluido ou tooltip completo

**M4 — Chips sem ícone na ação (só skill)**:
- "Falar com Cheiro" sem 🗣
- "Seguir em frente" sem 🚶
- Fix: detector LLM-side adicionar emoji prefix nas suggested_actions tool call

**M5 — Dice overlay pesado pra animar**:
- Dado 88×88 + sombra + tutorial inline + chip atributo + chip DC + button = vertical denso
- Em 812px viewport, sobra pouco espaço pra ler "Notar a emboscada antes do primeiro golpe"
- Fix: layout 2-col em portrait-narrow (info esquerda, dado direita)

### 🟢 Polish
**M6 — Tutorial Duolingo gigante em mobile**:
- Card "Bem-vindo a JSgame" centralizado mas com texto longo (4 linhas)
- "Pula" pequeno (16px), botão "Próximo" 44px
- Fix: padding tutorial maior, hit area "Pula" 44px

**M7 — Toast de share campaign ID antigo**:
- Mensagem "ID copiado! Cole no Home → Tenho o ID de uma crônica." é fiel ao novo wording mas linha longa pra toast
- Fix: toast em duas linhas ou só "🔗 ID copiado!"

**M8 — Echo do roll "🎲 Borin Forjarocha" na narração**:
- Mostra "🎲 Borin Forjarocha: percepcao (DC 12): rolou 15 → SUCESSO" como narração
- Boa info técnica, mas mistura com narração do Mestre
- Fix: estilo visual diferenciado (cinza menor) ou linha separadora

### 🎨 Estético
**M9 — Cold-open narração pesa muito (font-size 14px)**:
- Texto "Chuva fina cai sobre a estrada. Borin Forjarocha reconhece o caminho..." em font Cardo
- Hierarquia atual: speaker "MESTRE" 10px + texto 14px (corpo)
- Fix: aumentar texto inicial para 15-16px ou drop-cap na 1ª letra (já temos DndDropCapLine no roadmap)

**M10 — Background pleno preto chato**:
- Tela completa cor `#0a0608` (bg-deep) sem textura
- Não tem o "feel" de mesa medieval
- Fix: background sutil pergaminho texture-overlay 5% opacidade

## Plano 3 rounds (próxima sessão)

| Round | Foco | Issues | Tempo estimado |
|---|---|---|---|
| **M1** | Layout campanha mobile | M1+M2+M3 (crítico) | ~2h |
| **M2** | Polish visual | M4+M5+M8 (médio) | ~2h |
| **M3** | Refino estético | M6+M7+M9+M10 (polish) | ~1.5h |

## Como começar

```
Vou continuar o JSgame. Working tree limpo, 1591 tests verde, deploy em prod.
Sprint Dado Visível entregue. 10 achados novos pra polish.

[escolha 1]
- M1: Layout campanha mobile (dock sticky, dispensar dado, header)
- M2: Polish visual (chips com ícones, dice overlay 2-col, echo styling)
- M3: Refino estético (tutorial padding, drop-cap, background texture)
- Outro: ___
```

## Estado final

```bash
$ git log --oneline | head -8
<este> docs(D4): handoff sprint Dado Visível + plano
96f860e feat(D3): onboarding tutorial + detector expandido — dado fica óbvio
3cb9d63 feat(D2): "🎲 Tentar" picker persistente — player toma iniciativa de rolar
b0f40eb feat(D1): chip-skill visível — ícone 🎲 + border dourado + badge destacado + hit 44
077588b docs(D): HANDOFF próximos passos da equipe + CLAUDE.md atualizado
203e583 feat(C): polish coop errors + cold-open dramatic — humanize-error + first-narration
66dd5dd feat(B): polish combat — hit targets + 'Atacar' primary + Disparada→Disparar
30bcaa0 feat(A): polish wizard — hit targets + microcopy didática + tooltips progresso
```

Tests: **1591 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
