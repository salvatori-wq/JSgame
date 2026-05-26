# JSgame — Handoff 2026-05-26 (F33-F35 + Sprint E completos)

## 1. Estado atual

**Sessão completou 9 commits:** bug-fix is-portrait-narrow + F33 (wizard polish) + F34 (microinterações) + F23 (class features Big 7) + F24 (combat actions) + F25 (spell mechanics) + F26 (damage types) + F27 (saving throw) + F35 (server refactor).

**Tests: 398/398 verdes** (+70 novos: F23=27, F24=7, F25=13, F26=14, F27=9). typecheck limpo.

F28 (Inventory profundo) ficou **fora de propósito** conforme handoff anterior.

Sprint E (QA) concluído: smoke playtest zero bugs novos, cross-browser OK (mobile/tablet/desktop/wide), performance OK (4.4MB heap, 43ms API roundtrip), tests audit cobre todas áreas críticas.

## 2. Commits desta sessão

```
8e994f9 F35 — Refactor: dm-tool-applier extraído de campaign.ts (1415 → 1112 LOC)
598e818 F27 — Saving throw genérico (DM tool request_saving_throw)
38f6385 F26 — Damage types resistance/immunity/vulnerability multipliers
f89b261 F25 — Spell mechanics: concentration enforce + upcasting + ritual cast
4655dbe F24 — Combat actions: grapple/shove/help/two-weapon + disengage + bonus-action
9daf85c F23 — Class features Big 7 (rage/surge/second-wind/channel/ki/bardic/wild-shape) + Sneak Attack
04f6863 F34 — Microinterações: dice 3D + floating numbers + HP flash + skeletons
59bab79 F33 — Wizard polish: live preview lateral + compare modal + sliders
106e8d8 fix(layout): is-portrait-narrow só ativa se width<600 (não Math.min)
```

## 3. Mudanças por feature

### Bug-fix `is-portrait-narrow` (106e8d8)
- `src/client/main.ts`: trocado `Math.min(w,h) <= 480` por `w < 600` com listener `resize`/`orientationchange`. Bug do handoff anterior — laptop com janela estreita não cancela mais grid F30. Validado em viewport 1280/768/1440.

### F33 — Wizard polish (59bab79)
- `live-preview.ts`: mini-ficha lateral em tempo real (portrait, atributos, HP/AC/VEL, antecedente, missing-hint, point buy budget). Sticky desktop ≥1024, collapsível mobile.
- `compare-modal.ts`: tray flutuante + modal lado-a-lado para até 3 raças OU 3 classes (toggle na chip).
- `step-abilities.ts`: slider HTML5 paralelo aos botões +/- com clamp via budget check.
- `wizard.css`: +270 LOC pra live preview + compare tray/modal + slider responsivo.

### F34 — Microinterações (04f6863)
- `combat-screen.ts`: data-combat-target em enemy cards.
- `campaign-screen.ts`: data-combat-target em party cards. spawnFloating + flashHpBar disparados em onCombatEvent (damage/heal/crit/miss).
- `floating-number.ts`: pop animado em cima do alvo, anima ↑ + fade 1.2s.
- `campaign-core.css`: sc-die agora rotateX/Y 3D fake 500ms loop.
- `combat.css`: fn-pop styles + hp-flash 600ms.
- `features.css`: hover/active universal pra botões (translate -1px + glow rune), skeleton-card/line pulse pros endpoints lentos. main.ts mostra skeletons em chars/campaigns lists durante fetch.

### F23 — Class features Big 7 (9daf85c)
- `src/dnd/class-features.ts`: FEATURES table + getMaxFeatureUses (escala PHB exata) + sneakAttackDiceCount.
- `src/server/class-features-engine.ts`: ensureFeatureUses, useFeature switch (rage/surge/second-wind/channel-divinity/ki/bardic/wild-shape), Turn Undead detecta morto-vivo por nome regex, combat-local flags via WeakMap.
- `src/server/combat.ts`: integra rage damage bonus (+2/3/4 melee), rage resistance (½ dano físico), maybeSneakAttack (+Nd6 quando vantagem ou aliado).
- `CharacterSheet.classFeatureUses?` campo novo opt. addCharacter chama ensureFeatureUses no load.
- shortRest restaura short-features, longRest restaura tudo.
- Socket `useClassFeature` no server/index.ts.
- `class-features-bar.ts` cliente: botões dinâmicos por classe/nível, tooltip + uses N/max, prompt simples target (Bardic Inspiration).
- `combat.css`: +60 LOC bar features (gradient roxo, hover glow).
- 27 tests cobrindo getMaxFeatureUses, sneakAttackDiceCount, useFeature each Big 7, restore short vs long, Campaign integration.

### F24 — Combat actions completas (4655dbe)
- `combat.ts`: resolvePlayerDisengage seta flag, resolveGrapple (STR atletismo PJ vs surrogate enemy → 'restrito'), resolveShove ('caido'), resolveHelp (marca aliado 'helped-next-attack' → consumido em próximo resolvePlayerAttack pra vantagem).
- Two-weapon via `combatAction:'two-weapon'` emite attack off-hand 1d6 sem mod, gasta bonus-action flag.
- clearTurnFlags limpa também bonus-action-used + disengaged-this-turn.
- `combat-screen.ts`: novos botões Agarrar/Empurrar/2ª Arma + Ajudar com prompt aliado. Click no inimigo lê `__pendingCombatAction` pra rotear.
- `CombatActionKind` ganha 'two-weapon'.
- 7 tests cobrindo grapple sucesso, shove caido, help retorno, disengage flag, helped consumido após attack, bonus-action set/clear.

### F25 — Spell mechanics polish (f89b261)
- `CharacterSheet.concentratingOn?` novo campo opt.
- `SpellDef.upcastDice?` novo campo (escala dice por slot acima do base).
- `spells-engine.ts`: drop previous concentration ao lançar outra; computeUpcastBonus rola Nd× extras; tryBreakConcentration(target, dmg) CON save DC max(10, dmg/2); dropConcentrationIfUnconscious; ritual cast (spell.ritual && !combat) bypass slot.
- `combat.ts` resolveEnemyTurn chama tryBreakConcentration após dmg em PJ; downed também dropa.
- Long rest limpa concentratingOn.
- Spells atualizadas com upcastDice: magic-missile (+1d4/slot), cure-wounds (+1d8), healing-word (+1d4), burning-hands (+1d6).
- 13 tests cobrindo concentration enforce + upcasting + ritual.

### F26 — Damage types (38f6385)
- `src/dnd/damage-types.ts`: DamageType union (13 PHB types), damageMultiplier (immunity > vuln+resist=1 > vuln*2 > resist*0.5 > 1), applyDamageMultiplier (floor PHB), damageVerdict (texto).
- MonsterDef + EnemySnapshot + CharacterSheet ganham resistances/immunities/vulnerabilities/attackDamageType.
- Esqueleto recebe vulnerabilities=['contundente'] + immunities=['veneno'] (exemplo).
- combat resolvePlayerAttack + resolveEnemyTurn + spells-engine.applyDamageSpell aplicam multiplier vs profile, log mostra "[X bruto]→Y · imune/resistência/vulnerável".
- 14 tests cobrindo multiplier, applyDamageMultiplier, damageVerdict.

### F27 — Saving throw genérico (598e818)
- `CampaignState.pendingSave: { ability; dc; reason; playerId } | null` paralelo a pendingCheck.
- Socket event `resolveSavingThrow`.
- DM tool `request_saving_throw` (ability ∈ {for,des,con,int,sab,car}, clamp DC 5-30).
- Campaign.resolveSavingThrow: d20 + ability mod + (pb se proficient em proficientSavingThrows).
- Socket handler em index.ts emite diceRollResult purpose='saving-throw'.
- UI banner pendingSave em campaign-screen com botão "🎲 Rolar Save" pro dono.
- 9 tests cobrindo tool validation + Campaign.resolveSavingThrow.

### F35 — Server refactor (8e994f9)
- Extraído applyValidatedTool (310 LOC) de campaign.ts → dm-tool-applier.ts.
- campaign.ts 1415 → 1112 LOC (-22%).
- pushRecentEvent + indexFact promovidos a public (necessário pra extração).
- Lógica semanticamente idêntica.
- Tests verdes garantem zero regressão.

## 4. Sprint E — QA Results

### QA1 — Smoke playtest manual
- Server up, gemini provider OK, frontend renderiza home.
- Wizard testado: live-preview lateral aparece (260px desktop, full mobile), botões "⚖ comparar" funcionam, tray aparece com 2 raças, modal abre lado-a-lado.
- Step abilities: 6 sliders renderizam.
- Sheet view do Borin (Bárbaro Anão Montanha nv 3): atributos 17/12/16/10/10/8, HP 33, CA 13, HD 3/3, XP 900/1800.
- Console/network/server logs: **zero erros**.

### QA2 — Bug fixes priorizados
- Único bug do handoff (is-portrait-narrow) já resolvido em primeiro commit.
- Smoke não revelou novos bugs funcionais ou visuais.

### QA3 — Cross-browser smoke
- Mobile 375x812: is-portrait-narrow ativa, live-preview full-width collapsible, single-column.
- Tablet 768x1024: NÃO ativa, container 720 single-column.
- Desktop 1280x800: NÃO ativa, live-preview lateral 260px.
- Wide 1440x900: NÃO ativa, live-preview 260px lateral, container max-width 1280.

### QA4 — Performance check
- Memory heap: 4.4MB (saudável).
- API health roundtrip: 43ms.
- Gemini latência não medida (evita gastar quota; estimativa ~500ms cached, ~1-3s cold).

### QA5 — Tests audit
- 398/398 verdes, 21 test files.
- Áreas críticas do handoff cobertas:
  - F18 quest XP multi-PJ: quest.test.ts (23 tests)
  - F20 streak edge cases: streaks.test.ts (9 tests)
  - F23 class features uses: class-features.test.ts (27 tests novos)
  - F25 concentration breaks: concentration.test.ts (13 tests novos)

## 5. Pontos de atenção

- **Concentration cliente UI**: PJ não vê visualmente se está concentrando. Future enhancement: badge no party-panel.
- **Bardic Inspiration buff**: implementação minimal — só log+condition, não aplica +1d6 real em próximo roll. Próxima fase precisa de "buff engine" (similar a F23 features flags).
- **Counterspell/Dispel Magic**: noted como TODO em F25, fora do escopo MVP.
- **Refactor F35**: só extraído dm-tool-applier. routes/* e sockets/* futuros ainda não.
- **F26 racial damage profile**: CharacterSheet tem os campos opt, mas wizard não popula automaticamente (Tiefling=resist fogo etc). Future enhancement.

## 6. Comandos essenciais

```bash
npm run dev          # backend (3001) + frontend (5173)
npm run typecheck    # tsc --noEmit
npm test -- --run    # vitest run (398/398)
```

URLs: http://localhost:5173 (desktop) · http://192.168.15.3:5173 (mobile)

## 7. Deploy / env

- URL prod: https://jsgame-drpe.onrender.com (ainda em commit antigo F10 `603e168`)
- Repo: https://github.com/salvatori-wq/JSgame
- **Total commits locais a partir de prod**: 21 commits (era 12 no handoff anterior, +9 essa sessão).
- Env vars novas: nenhuma adicional pra F23-F27/F33-F35. Mesmo GEMINI_API_KEY.

## 8. Mensagem pra próxima conversa

> Lê `HANDOFF_2026-05-26_F33-F35-QA-done.md` na raiz. F33-F35 + F23-F27 estão commitados (9 commits, 398/398 verdes, typecheck limpo). Sprint E (QA) também concluído — zero bugs novos no smoke playtest.
>
> Próximas tarefas em aberto (não-bloqueantes, escolha conforme prioridade):
> 1. Push pra Render (21 commits locais acumulados — fazer manual quando quiser deploy).
> 2. Buff engine genérico (Bardic Inspiration +1d6, Bless, Guidance etc — F25 deixou só placeholder).
> 3. Counterspell/Dispel Magic interactions (F25 noted como TODO).
> 4. Refactor routes/* e sockets/* (F35 só extraiu dm-tool-applier; index.ts ainda 1205 LOC).
> 5. Racial damage profile auto-populated no wizard (Tiefling=resist fogo, Anão=resist veneno).
> 6. UI badge "Concentrando em X" no party panel (F25 backend completo, falta visual).
>
> Regra zero-budget mantida. Sem mexer em Cave Run (`C:\Users\JOÃO\D&D online\`).
