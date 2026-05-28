# Handoff — Sprint Φ "Visual Authentic D&D" — entregue

> **Data**: 2026-05-28 · **6 commits feature + 1 commit handoff** · **1462 → 1559 tests verde (+97 net)** · **deploy via auto-push (Render)**

## 1. Contexto entregue

Plano de `HANDOFF_2026-05-28_sprint-phi-plano.md` executado end-to-end. Sprint Φ
elevou qualidade visual D&D autêntica absorvendo padrões oficiais (paleta + layout)
do repo `rpgtex/DND-5e-LaTeX-Template` (MIT). Outros 2 repos analisados
descartados como fonte direta (`dnd-tldr` sem dataset estruturado; `Mindustry`
patterns de modding fora de escopo).

## 2. Commits do sprint

```
213c8b2 feat(Φ.1): paleta D&D 5e oficial — tokens autênticos pra StatBlock/SpellCard/ItemCard
88aaf2f feat(Φ.2): StatBlock component D&D 5e autêntico — NPCs + combat enemies
32cdd4c feat(Φ.3): SpellCard com cores oficiais por escola D&D 5e
f6c4b12 feat(Φ.4): ItemCard com rarity glow oficial DMG + atunement badge
de05968 feat(Φ.5): tipografia D&D autêntica — Cinzel + Cardo via Google Fonts
<este>  docs: HANDOFF Φ done + CLAUDE.md atualizado
```

## 3. O que foi entregue

### Φ.1 Design tokens D&D oficial
Paleta extraída de `lib/dndcolors.sty` (rpgtex/DND-5e-LaTeX-Template, MIT) em
namespace `--dnd-*` no `_tokens.css`. Sem regressão dos tokens de tema.

- 4 cores tipográficas (title-red/gold/rule-red/contour-gray)
- 4 cores stat block (ribbon/bg/read-aloud/page-gold)
- 6 trim PHB/DMG (phb-green/cyan/mauve/tan + dmg-lavender/coral)
- 6 rarities oficiais DMG p.135 (common→artifact)
- 8 spell schools (abjuration→transmutation)

### Φ.2 StatBlock component
NPC/Monster no formato OFICIAL D&D 5e — fundo tan #FDF1DC, fitas gold #E69A28
top/bottom, título Cinzel sangue D&D, régua triangular, ability scores grid 6-col.

**3 entry points:**
- `enemyToStatBlock(EnemySnapshot)` — combat enemy detail (botão ℹ no card)
- `npcToStatBlock(NpcMemory)` — NPC roster Met (footer "📋 Ficha")
- `renderStatBlock(StatBlockData)` — manual

**Modal wrapper**: bottom-sheet mobile / centered desktop, fecha ESC/backdrop/swipe-down.

### Φ.3 SpellCard component
Cards de magia por escola com 8 cores temáticas. Fita superior colorida, school
badge com icon, level chip (TRUQUE / Nv X), stats grid (Alcance / Componentes / Duração),
tags Concentração / Ritual, upcast hint pra spells ≥1.

**API**: `renderSpellCard(spell, { compact?, canCast?, onClick? })`
- compact: cast-spell-modal lista
- full (default): tooltips/details futuras

Helpers puros: `schoolLabel/Icon/Token`, `parseComponents` (V/S/M + material).

### Φ.4 ItemCard com rarity glow
Items com cores oficiais DMG p.135. Glow proporcional:
- Comum: zero
- Incomum: outline subtle
- Raro: 8px
- Muito-raro: 12px
- Lendário: 18px + animação pulse 3.2s (reduced-motion respeitado)

Atunement badge: ◇ Sintonia (inactive) / ◈ Sintonizado (gold glow active).

Tipos novos em `InventoryItem`:
- `requiresAttunement?: boolean`
- `isAttuned?: boolean`

### Φ.5 Tipografia D&D autêntica
**Google Fonts** via `index.html` (preconnect + display=swap):
- **Cinzel** (heading) — small caps elegantes igual livros
- **Cardo** (body) — serif Bookman-like dos livros impressos

`--font-body` atualizado pra `'Cardo'` first. Fallback chain mantida pra zero-impact
se Google Fonts bloqueado. Validado em preview_eval: `document.fonts.check()` true
pras 2 fontes.

### Φ.6 Handoff + docs
- CLAUDE.md atualizado (seção "Estado Atual" → Sprint Φ entregue)
- Este HANDOFF

## 4. Tests + Typecheck

- **Antes**: 1462 tests verde
- **Depois**: 1559 tests verde (+97 net)
- Typecheck `tsc --noEmit`: zero erros
- Zero regressão

Breakdown por sub-sprint:
| Sub-sprint | Tests novos |
|---|---|
| Φ.1 dnd-tokens | 12 |
| Φ.2 stat-block | 29 |
| Φ.3 spell-card | 22 |
| Φ.4 item-card | 18 |
| Φ.5 typography | 16 |
| **Total** | **+97** |

## 5. Validação visual

Tentativa de screenshot em preview travou (mesma issue de sprints anteriores —
preview_screenshot pula recursividade). **Validação via preview_eval** confirmou:

- `getComputedStyle(body).fontFamily` → `Cardo, "Cormorant Garamond", ...` ✅
- `document.fonts.check('700 16px Cinzel')` → `true` ✅
- `document.fonts.check('400 16px Cardo')` → `true` ✅
- StatBlock mount end-to-end OK ✅
- `bgColor` = `rgb(253, 241, 220)` (= `#FDF1DC` token exato) ✅
- `nameColor` = `rgb(88, 24, 13)` (= `#58180D` token exato) ✅
- Zero erros no console

## 6. Próximos passos sugeridos

Sprint Φ entrega "visual autenticidade" — fonte vinda dos livros oficiais. Áreas
adjacentes que valem investigação numa próxima sessão:

1. **Drop cap inicial em narração** — `rpgtex/DND-5e-LaTeX-Template` tem
   `\DndDropCapLine`. Primeira letra grande Royal+contour. Aplicar em cold
   opens / chapter-style narration. ~2h.
2. **Read-aloud box** — fundo #F7F2E5 (token --dnd-read-aloud já existe), borda
   gold, primeiro parágrafo em italic. Estilo "leia em voz alta" oficial.
   Aplicar quando DM marca trecho como "destaque". ~3h.
3. **Sidebar component** — fundo themed (PHB green/cyan/mauve/tan) com header
   sans-serif bold. Usar pra rules variants, dicas. ~2h.
4. **Spell list view detalhada** — usar SpellCard `full` variant em modal de
   spellbook completo (não preparados). Drill-down de feiticeiro. ~3h.
5. **Stat block em quest log** — boss reveal antes de combate começar.
   Tap em quest objective `derrote X` mostra stat block (sem HP atual). ~1.5h.

## 7. Riscos / atenções

- **Google Fonts CDN**: se bloqueado por rede corporativa/firewall, Cardo+Cinzel
  caem pra fallback (Cormorant/Georgia). UX não quebra mas perde charme.
- **Lendary pulse animation**: testado com prefers-reduced-motion. Confirmar em
  iPhone Safari (PRM padrão em iOS 15+).
- **AC/HP color contrast em stat block**: fundo #FDF1DC + texto #2a1f15 → ~10.7:1
  WCAG AAA. Sem issue.

## 8. Como começar próxima sessão

```
Vou continuar o JSgame. Working tree limpo, 1559 tests verde, deploy em prod
(jsgame-drpe.onrender.com). Sprint Φ entregue — paleta + 3 componentes + fontes
oficiais D&D 5e.

[escolha 1 ou propõe outro]
- Drop cap em narração (DndDropCapLine extraído do LaTeX)
- Read-aloud box temática
- Sidebar component
```

## 9. Estado final

```bash
$ git log --oneline | head -7
<este> docs: HANDOFF Φ done
de05968 feat(Φ.5): tipografia D&D autêntica — Cinzel + Cardo via Google Fonts
f6c4b12 feat(Φ.4): ItemCard com rarity glow oficial DMG + atunement badge
32cdd4c feat(Φ.3): SpellCard com cores oficiais por escola D&D 5e
88aaf2f feat(Φ.2): StatBlock component D&D 5e autêntico — NPCs + combat enemies
213c8b2 feat(Φ.1): paleta D&D 5e oficial — tokens autênticos pra StatBlock/SpellCard/ItemCard
48cb6f4 docs: HANDOFF Sprint Φ 'Visual Authentic D&D' — plano executável próxima sessão
```

Tests: **1559 verde** · Typecheck: **OK** · Working tree: **limpo após este handoff**
