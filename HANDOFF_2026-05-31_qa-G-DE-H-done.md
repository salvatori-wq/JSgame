# Handoff — QA de Lançamento: Ciclos G + D/E + H entregues

## Resultado (pro deploy)

**Manual Deploy → "Deploy latest commit"** no Render. `origin/main` = `e396d9f`
(local em sync; full suite **verde** — exit 0; tsc limpo). ⚠️ A sessão de áudio
("trilha/Onda") segue commitando no mesmo `main` em paralelo e faz rebase, então
o HEAD pode ter avançado — **use sempre o latest commit**. Meus fixes de QA estão
todos presentes (verificado por conteúdo no HEAD).

## O que foi entregue (ciclo DISCOVER→REPRODUCE→FIX→VERIFY→COMMIT→DOCUMENT)

### Ciclo G — Mestre/Narrativa
- **Sessão longa real capturada** (24 turnos variados: explorar, falar, texto
  livre, combate, descanso, inputs absurdos) → `QA_G_TRANSCRIPT.txt` (commitado).
- **DM Dramaturgo (juiz)** rodado. Veredito: narração LLM **online de ALTA
  qualidade** — persona Sombrio/Trickster forte, PT-BR natural, **fog-of-war
  respeitado** (zero HP/CA/DC em prosa), callbacks coerentes (carcereiro, runas).
- **`fix(jargão)` `6c784d1`**: o **FallbackDM** (Mestre offline) vazava o ENUM CRU
  em inglês na narração visível — "Você **attack** (…)", "Você **custom** (…)",
  "Você **sneak** (…)" — reproduzido no transcript (linhas 17/21/24/28/31, mesmo
  bug do Ciclo U no caminho degradado). `offlineActionVerb()` em `dm.ts` mapeia pra
  verbo PT-BR. +13 guards em `dm-narration-recovery.test.ts`.

### Ciclo D/E — Itens & Progressão
- **`fix(itens)` `1dffbc1`** (Rules Lawyer, reproduzido em teste): (1) **cota de
  malha** vinha `13+min(2,DEX)` (armadura média) → **CA 16 fixa** (pesada, PHB
  p.145); (2) o **+2 do escudo sumia** ao equipar o corpo → preservado; (3)
  **escudo empilhava** (+2 por equip) → guard de 1 escudo (PHB p.144). +6 guards em
  `item-equip-ac.test.ts`.
- **Conferido CORRETO** (executei o módulo real): XP L1-20 = PHB p.15, prof bonus,
  HP no level-up (avg+CON sem dobrar), descanso longo recupera METADE dos hit dice,
  pact slots no curto, ASI 4/8/12/16/19 + Fighter/Rogue. `leveling.ts` está certo.

### Ciclo H — Visual Global (z-index/sobreposição)
- **Mapa GLOBAL de z-index** levantado (2 Inspetores Visuais). **`fix(visual)`
  `205404f`**, ambos provados no browser real: (1) **confetti do level-up era
  engolido** pelo backdrop (z-9700 < 9999) → **z-10001** (`elementFromPoint` no
  centro agora acha a partícula); (2) **overlay do level-up não rolava** → topo do
  card cortado em tela curta/deitado → backdrop+card `overflow-y:auto` +
  `max-height` (provado a 568h: card rola, topo visível). +3 guards em
  `qa-visual-overlap.test.ts`.
- **Falsos-positivos descartados** (reproduzidos como NÃO-bug): skill-check
  `.sc-overlay` z-9000 no `#app` — `#app` não cria stacking-context aqui
  (transform:none, isolation:auto) e em solo não há bottom-tab-bar/chat-pill, sem
  cobertura real.

## Commits desta rodada (origin, hashes podem mudar pelo rebase do áudio)
- `1dffbc1` fix(itens): cota de malha = CA 16 + escudo nao empilha/some (PHB)
- `6c784d1` fix(jargao): Mestre offline nao vaza enum cru em ingles (PT-BR)
- `205404f` fix(visual): confetti do level-up visivel + card rola em tela curta
- `e396d9f` docs(qa): checklist temas G/D/E/H — verde + deferidos documentados

## Deferidos (documentados no checklist §4, não bloqueantes)
- **Combate (de C):** 2ª arma soma mod ao dano (PHB p.195); magia ignora vantagem
  por condição do alvo.
- **Coop (de F, ALTA, ciclo próprio):** restart perde party; joinCampaign sem
  watchdog; join no meio do combate fora da iniciativa; disconnect trava turno.
- **D/E:** sintonia (attunement) é cosmética (sem cap 3, nunca setada) — decisão de
  produto; feat Durable no-op no descanso curto; PJ caído-vivo sem XP (ruling).
- **G:** no dev o cascade groq→gemini caiu ~70% (em prod com keys boas é raro —
  confirmar); FallbackDM ecoa ação **stale**; sessão de 45-60 min + juiz aprofundada.
- **H:** pile-up pós-combate (toast/vignette) + 4 sticky top:0 do combate — confirmar
  em jogo real (não reproduzidos sob o lag desta sessão).

## Estado dos temas (checklist §4)
A ⚠️ · B ⚠️ · **C ✅** · **D ⚠️→fix** · **E ✅** · **F ✅** · **G ⚠️→fix** ·
**H ✅** · I ✅(parcial) · J 📱(aparelho do João).
Restam pra "pronto pra lançar": sessão de 60 min limpa + smoke no aparelho.

## Aprendizados desta sessão
- **Ambiente com LAG de buffer severo + escritor git concorrente.** Resultados de
  tool (Bash/Read/eval) atrasavam ~1 turno e às vezes vinham mangled. Mitigação:
  escrever resultado em arquivo e ler (`> /tmp/x; cat`), verificar commits por
  CONTEÚDO no HEAD (não por hash — o rebase do áudio muda hash), commitar com
  caminhos explícitos (nunca `-A`), nunca editar sob lag sem reler o arquivo real.
- **Editar da paráfrase do agente = Edit falha.** Os hunters dão `file:line` ótimos
  mas paráfrase do texto; SEMPRE reler o arquivo real antes de Editar (errei 2x sem
  dano). O Rules Lawyer disse "enfeitiçado" (acento) mas o enum é `enfeiticado`.
- **singleFork vaza `body.*`/estado entre arquivos** → testes que dependem de estado
  global flakam no full-run mas passam isolados; confirmar isolado + tsc, confiar no
  EXIT do vitest (já era aprendizado do projeto; reconfirmado).
- **Harness de transcript** (socket bot, 24 turnos) é um bom método pra G sem
  depender do preview; usar `writeFileSync` (não `console.log`+exit, que trunca).
