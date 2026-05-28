# Handoff — Sprint Φ "Visual Authentic D&D" — plano executável

## 1. Contexto pra próxima sessão

**Working tree limpo. 1462 tests verde. Último commit `d97c7ba` em prod.**

```
git log --oneline | head -5
d97c7ba fix(Ω.10): home redesign sério mobile — cards cohesion + footer bottom-tab nav
e847700 fix(Ω.9): layout campanha redesign + prompt guardrails — fim do frankenstein
4322ae1 fix(Ω.8): cold opens reescritos — narração impecável
839d3c0 feat(polish-Ω.7): PWA install banner
20555e3 fix(Ω.6): diag maxTokens
```

Sprint Ω (Ω.1–Ω.10) entregue end-to-end. Próximo: elevar **qualidade visual D&D autêntica** absorvendo padrões de 3 repos analisados.

## 2. Análise dos 3 repos (decisões já tomadas)

### `rpgtex/DND-5e-LaTeX-Template` ⭐ ALTO VALOR
**O que tem**: Pacote LaTeX completo pra criar suplementos D&D 5e oficial. License MIT.
**Reusável**:
- Color palette oficial (hex codes em `lib/dndcore.def` + `lib/dnd.sty`)
- Stat block component (estrutura: nome / tipo / AC / HP / abilities grid 6 / skills / senses / actions / reactions / legendary)
- Spell card formato (school / range / duration / components / description)
- Item card com rarity tiers
- Typography hierarchy (font weights, sizes, spacing)
- Layout 2-column model → CSS Grid

**Como portar**: ler `.sty/.def` diretamente, extrair tokens, refazer componentes em TS+CSS. NÃO importar LaTeX (não roda em browser).

### `Miserlou/dnd-tldr` ⚠️ BAIXO VALOR DIRETO
**O que tem**: Markdown + PDFs de regras condensadas. Sem JSON/YAML, sem dataset estruturado.
**Reusável**: filosofia "fun-optimized, fast-paced" alinha 100% com JSgame. Validar character sheets por race/class combinations (nossos prefabs cobrem arquétipos icônicos? Borin/Lyra/Sina = sim).
**Decisão**: NÃO absorver código/dados. Só conferir filosofia narrativa nas instructions do DM.

### `Anuken/Mindustry` ⭐ MÉDIO VALOR (UX patterns)
**O que tem**: Jogo opensource Java factory builder. 27.7k stars, mobile + desktop + iOS.
**Reusável**:
- HUD layering patterns (transparent overlays sobre conteúdo gameplay)
- Mode transitions com peso visual (animations curtas funcionais)
- Localização robusta (`TRANSLATING.md` style)
- Onboarding progressivo escalonado
- Modding system → futuro: homebrew rules custom

**Decisão**: estudar visualmente como Mindustry trata HUDs em mobile. Não portar código (Java).

## 3. Sprint Φ — plano executável

### Φ.1 — Design tokens D&D oficial (~1.5h, 1 commit)

**Objetivo**: substituir tokens visuais ad-hoc por paleta oficial D&D 5e.

**Steps**:
1. Clonar `rpgtex/DND-5e-LaTeX-Template` em `/tmp/dnd-latex/` (só pra extração, não commit)
2. Extrair de `lib/dndcore.def` e `lib/dnd.sty`:
   - Hex codes oficiais: vermelho-sangue D&D (#822000 area), gold (#bf983a area), dark ink, parchment
   - Font definitions
3. Atualizar `src/client/styles/_tokens.css` com paleta autêntica
4. Garantir contrast WCAG AA (tinta sobre fundo) — usar checker
5. Validar visual: home + campaign não regridem

**Arquivos**: `src/client/styles/_tokens.css` (editar)

**Tests**: snapshot CSS dos tokens em existing test (atualizar valores esperados se já houver)

### Φ.2 — StatBlock component (~2.5h, 1 commit)

**Objetivo**: criar componente reusável que renderiza NPC/Monster no formato OFICIAL D&D 5e (igual aos livros).

**Steps**:
1. `src/client/components/stat-block.ts` NOVO
2. Input: `StatBlockData { name, size, type, alignment, ac, hp, speed, abilities (str/dex/con/int/wis/cha), saves, skills, senses, languages, cr, actions[], reactions[], legendary[] }`
3. Output: HTMLElement com:
   - Header: nome em Cinzel + tipo/size/alignment em italic
   - Linha sangue divider
   - AC / HP / Speed em grid 3-col
   - Ability scores grid 6-col (STR/DEX/CON/INT/WIS/CHA) com modifier
   - Saves + skills + senses + languages compact
   - CR badge
   - Sections: Actions / Reactions / Legendary Actions (cada uma com title bold + entries)
4. `src/client/styles/stat-block.css` NOVO: layout 2-col responsivo, mobile stack
5. Usar em:
   - `src/client/campaign/npc-roster-modal.ts` (NPCs Met)
   - `src/client/combat/combat-screen.ts` (enemy details on tap)
6. **15 tests** novos: render todos campos, mobile stack, missing fields graceful

**Arquivos**: 
- NOVO `src/client/components/stat-block.ts`
- NOVO `src/client/styles/stat-block.css`
- NOVO `src/client/components/__tests__/stat-block.test.ts`
- EDITAR `npc-roster-modal.ts` + `combat-screen.ts`
- EDITAR `styles.css` (import)

### Φ.3 — Spell card component (~2h, 1 commit)

**Objetivo**: cards de magia visualmente autênticos D&D 5e.

**Steps**:
1. `src/client/components/spell-card.ts` NOVO
2. Mapping `SpellSchool → color` (8 escolas: abjuração/conjuração/divinação/encantamento/evocação/ilusão/necromancia/transmutação)
3. Layout:
   - School icon + color badge top-left
   - Level + school text
   - Casting time / range / components (V/S/M icons) / duration grid 4-col
   - Description com markdown leve
   - "At higher levels" se houver
4. Usar em spell-modal existente
5. **8 tests** novos

### Φ.4 — Magic item card com rarity glow (~1.5h, 1 commit)

**Objetivo**: items mágicos com rarity colors autênticas + atunement badge.

**Steps**:
1. `src/client/components/item-card.ts` NOVO
2. Rarity colors (oficial DMG): common (gray) / uncommon (green) / rare (blue) / very rare (purple) / legendary (orange) / artifact (red) / wondrous (varies)
3. Layout: icon left + name + rarity + type + "Requires attunement" badge + description
4. CSS box-shadow glow por rarity (subtle)
5. Usar em inventory-modal
6. **7 tests** novos

### Φ.5 — Typography + Microcopy review (~1h, 1 commit)

**Objetivo**: tipografia consistente com livros D&D + termos padronizados PT-BR.

**Steps**:
1. Verificar se Cinzel já está sendo usada (já é nossa heading font). OK.
2. Adicionar fonte body mais próxima dos livros: "Bookman Old Style" ou "Cardo" (Google Fonts) — fallback serif
3. Padronizar headers de seção em campaign:
   - "Ações" / "Reações" / "Recursos" / "Atributos" (já bom)
   - Adicionar "Tesouros" pra inventory section
4. Verificar capitalização em strings UI (atualmente mix de Title Case e lowercase)
5. Snapshot test pra strings críticas

### Φ.6 — Tests + docs + handoff (~1h, 1 commit)

**Steps**:
1. Rodar full suite — esperado: 1462 → ~1497 (+~35 net)
2. Atualizar `CLAUDE.md` com Sprint Φ entregue
3. Criar `HANDOFF_2026-05-28_sprint-phi-done.md`
4. Deploy via Render API
5. Validar em prod via `curl /api/dm/diag`

## 4. Cronograma estimado

| Sprint | Tempo | Commits |
|---|---|---|
| Φ.1 Tokens | 1.5h | 1 |
| Φ.2 StatBlock | 2.5h | 1 |
| Φ.3 SpellCard | 2h | 1 |
| Φ.4 ItemCard | 1.5h | 1 |
| Φ.5 Typography | 1h | 1 |
| Φ.6 Tests + handoff | 1h | 1 |
| **Total** | **~9.5h** | **6 commits** |

## 5. Recursos pra próxima sessão

### Repos pra clonar/inspecionar (NÃO commit)
```bash
git clone https://github.com/rpgtex/DND-5e-LaTeX-Template /tmp/dnd-latex
# Extrair:
# - /tmp/dnd-latex/lib/dndcore.def → hex codes
# - /tmp/dnd-latex/lib/dnd.sty → font specs + macros
# - /tmp/dnd-latex/img/ → ver se algum SVG é útil (license MIT permite)
```

### Comandos essenciais
```bash
cd "C:\Users\JOÃO\JSgame"
npm run dev          # backend + frontend paralelos
npm run typecheck    # tsc --noEmit
npm test -- --run    # full suite (1462 tests)
```

### Deploy + diag prod
```bash
# Trigger deploy via Render API (key revogada após Sprint Ω — gerar nova se necessário)
# curl /api/dm/diag pra status providers
curl https://jsgame-drpe.onrender.com/api/dm/diag | python -m json.tool
```

## 6. Decisões já feitas (não pedir aprovação)

| Decisão | Resposta |
|---|---|
| Absorver `dnd-tldr` dataset? | NÃO — não tem dataset estruturado |
| Modding/homebrew system (Mindustry)? | NÃO neste sprint — escopo grande, mover pra futuro |
| Portar código LaTeX direto? | NÃO — extrair conceitos (cores/layout), reimplementar em TS+CSS |
| Onde usar StatBlock? | NPC roster modal + combat enemy detail |
| Onde usar SpellCard? | spell-modal existente |
| Onde usar ItemCard? | inventory-modal existente |
| Rarity glow no item card? | SIM, sutil (não distrair) |
| Importar Bookman Old Style do Google Fonts? | SIM (1 weight só, ~30kb) |

## 7. Validação esperada pós-Sprint Φ

- [ ] Tests 1462 → ~1497 (+~35) verde
- [ ] Typecheck OK
- [ ] StatBlock renderiza em NPCs Met + combat enemy detail
- [ ] SpellCard em spell-modal com cores por escola
- [ ] ItemCard em inventory com glow por rarity
- [ ] Tokens D&D oficiais aplicados (verificar 1 hex no campaign)
- [ ] Deploy live em prod
- [ ] CLAUDE.md + HANDOFF_done atualizados

## 8. Risk register

| Risco | Mitigação |
|---|---|
| Tokens novos quebram visual existente | Snapshot tests + preview validation antes/depois |
| StatBlock muito grande em mobile | Layout 1-col stack + collapsible sections |
| Google Fonts request lento | Self-host fonte + font-display: swap |
| LaTeX extraction tediosa | Buscar repos derivados como JSON (5e.tools APIs públicas) |
| Render free tier lento (deploy 4min) | Aceitar — já é norma |

## 9. ⚠️ Importante pro João

**Render API key revogada (recomendado)**: a key `rnd_lcBsg5Qj...` usada em Sprint Ω deve ser deletada em https://dashboard.render.com/u/settings#api-keys

**Se quiser que próxima sessão tbm faça deploy automático**: gere nova API key e cole logo no início da sessão. Caso contrário, deploy continua manual (botão "Deploy latest commit" no dashboard).

## 10. 🎯 Como começar a próxima conversa

Cole esta mensagem inicial pra Claude:

```
Vou continuar o JSgame. Leia HANDOFF_2026-05-28_sprint-phi-plano.md na raiz —
plano detalhado pronto, decisões já tomadas. Execute Sprint Φ inteiro autônomo
(~9.5h, 6 commits), push após cada. CLAUDE.md + HANDOFF_done ao final.
Tests + typecheck OK em cada commit.

Estado atual: 1462 tests verde, último commit d97c7ba, working tree limpo,
deploy ao vivo em prod (https://jsgame-drpe.onrender.com).

[opcional] Render API key pra deploy automático: rnd_xxxxx
```

Decisões D&D estéticas já confirmadas no doc (seção 6) — execute sem perguntar.
