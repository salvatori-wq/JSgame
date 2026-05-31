# Plano · Trilha Sonora Medieval do JSgame ("Bardo")

> Objetivo do João: trilha **muito boa, medieval, ritmada, nova, envolvente**.
> Restrições do projeto: **zero budget** (sem serviço pago/IA de música paga),
> **DOM puro**, **procedural Web Audio** (decisão consolidada: "synth procedural >
> MP3 — zero bundle bloat, zero risco iOS Safari"). Mobile-first.

---

## 1. Análise completa do que existe hoje

O jogo **já tem** um motor de trilha medieval procedural (não começamos do zero):

| Arquivo | Papel |
|---|---|
| `src/client/audio.ts` | AudioContext mestre (gain 0.35), unlock por gesto (iOS), SFX (dado, hit, crit, level-up, page-turn, heartbeat, spell). Re-exporta a API ambient. |
| `src/client/audio/modes.ts` | 7 modos (dorian/phrygian/mixolydian/aeolian/lydian/major/minor), `getScale`, `midiToHz`, `ROOTS`. |
| `src/client/audio/instruments.ts` | `pluck`, `flute`, `drumKick`, `drumTom`, `drumHat`, `bell`, `heartbeat`, `padDrone`. |
| `src/client/audio/sequencer.ts` | Scheduler lookahead (Chris Wilson) — timing sample-accurate apesar do setInterval. |
| `src/client/audio/ambient.ts` | 10 moods, cada um = pads + sequencers + one-shots. `setAmbient(mood)` com crossfade 0.6s. Bus a 0.18. |

**Integração:** `main.ts:43` arma o gesto; `campaign-screen.ts` mapeia estado→mood
via `pickAmbientMood(state, character)` (shop / combat-boss / combat-skirmish /
danger-low-hp / rest / exploration-calm) a cada `campaignState`; toggle "🎵 Música
ON/OFF" no overflow do header; ambient default **ON**. Testes: `trilha-medieval.test.ts`
+ `audio-sprint-x.test.ts`.

### Pontos fortes
- Arquitetura limpa e testável (modos/instrumentos/sequencer/ambient separados).
- 100% procedural — zero bytes, sem risco iOS, unlock por gesto resolvido.
- Modos eclesiásticos corretos; sequencer com timing preciso; crossfade funciona.

### Limitações que impedem "muito boa / envolvente" (o diagnóstico)
1. **Repetitivo** — loops fixos curtos (6–16 steps) sem variação → fadiga de ouvido
   em ~10s. *É o problema #1 para "envolvente".*
2. **Orquestra magra** — só pluck/flute/drum/bell. Falta alaúde dedilhado, hurdy-gurdy,
   vielle (arco), recorder, saltério, harpa, tabor/bodhrán variados, sino de igreja
   rico, shawm/bombarde (palheta para boss).
3. **Sem melodia memorável** — moods são *textura*, não *tema*. "Envolvente" pede um
   gancho — um **tema principal** reconhecível (leitmotif).
4. **Pouco ritmo** — "ritmada" é palavra-chave do João. Ritmos atuais são básicos.
   Faltam as formas de dança medievais (estampie, saltarello, ductia, basse danse).
5. **Sem movimento harmônico** — quase só drone + 1 linha. Falta organum (4ªs/5ªs
   paralelas) e cadências ouvert/clos.
6. **Sem intensidade adaptativa** — combate não escala, exploração não respira.
7. **Mix cru** — gain plano, sem reverb (salões de pedra!), sem stereo, sem
   compressor. Um `ConvolverNode` (reverb) transforma o "feel" inteiro.

---

## 2. Visão da trilha "Bardo"

Elevar de **"gerador de textura ambiente"** para **"compositor medieval generativo"**:
temas compostos à mão (dados de notas) + dança rítmica + síntese rica de instrumentos
+ camadas adaptativas + reverb de salão. Continua 100% procedural / zero byte.

**Os 7 pilares**
1. **Fundação medieval autêntica** — modos + cadências (ouvert/clos) + organum + drone.
2. **Orquestra sintetizada rica** — ~12 instrumentos com recipes DSP fiéis.
3. **Composição generativa** — gerador de melodia (walk modal ponderado, frase
   antecedente/consequente, motivo + variação) + **leitmotif assinatura** do JSgame.
4. **Motor rítmico** — grooves de dança (estampie/saltarello/ductia/basse-danse/guerra).
5. **Camadas adaptativas** — cada mood = pilha de stems (drone/ritmo/harmonia/melodia/
   ornamento) com `intensity` 0..1 escalando combate e respirando exploração.
6. **Mix espacial** — `ConvolverNode` (IR procedural: salão/caverna/taverna/catedral) +
   compressor/limiter + stereo + buses por seção (nunca clipa, soa "produzido").
7. **Transições + stingers** — trocas beat-synced, cadências de transição, stingers de
   evento (level-up, descoberta, NPC) tecidos na cama musical.

**Como garanto qualidade sem ouvir** (ambiente headless): teoria musical testada
(modos/cadências/intervalos), recipes DSP conhecidos, e medição via `AnalyserNode`
no preview (RMS/peak ≠ 0 = há som; peak < 1 = não clipa) + harness DEV de audição
para o João (que ouve) validar e me dar feedback.

---

## 3. As Ondas (executadas autonomamente, 1 commit cada, com testes)

### Onda 1 — Núcleo de áudio profissional
`audio/mixer.ts` (compressor/limiter mestre + `ConvolverNode` reverb com IR procedural
hall/cave/tavern/cathedral + envio por mood + stereo). Expandir teoria em
`audio/theory.ts`: cadências ouvert/clos, intervalos de organum, walk modal ponderado,
nome↔midi, transpor. Rotear ambient pelo mixer. **Tests:** grafo do mixer, IR
determinístico, helpers de teoria.

### Onda 2 — Orquestra medieval expandida
Expandir `instruments.ts`: `lute` (corda dupla detune + corpo), `hurdyGurdy` (drone +
buzz + chanter), `vielle` (arco: sawtooth + lowpass sweep + vibrato), `recorder`,
`psaltery`, `harp` + `harpGliss`, `tabor`, `bodhran`, `nakers`, `churchBell` (parciais
inarmônicos), `shawm` (palheta, boss). Ornamentos: `trill`, `mordent`, `graceNote`,
`slide`. **Tests:** cada instrumento agenda nós corretos, sem throw.

### Onda 3 — Motor de composição generativa
`audio/composer.ts`: `MelodyGenerator` (walk modal ponderado, frase antecedente/
consequente com cadência ouvert/clos, memória de motivo + variação), `RhythmPatterns`
(estampie/saltarello/ductia/basse-danse/war), RNG seedável (testável). `audio/themes.ts`:
**leitmotif assinatura** do JSgame + variações por mood. **Tests:** melodia fica na
escala, frases resolvem na tônica (clos), RNG reproduzível, dados de tema válidos.

### Onda 4 — Moods adaptativos em camadas
Reconstruir builders do `ambient.ts` para usar composer + novos instrumentos + **stems
empilhados** (drone/ritmo/harmonia/melodia/ornamento), cada um no seu gain.
`setAmbientIntensity(0..1)` faz fade das camadas. Versões mais longas e evolutivas dos
10 moods + novos (taverna, sagrado/catedral, viagem/marcha). Crossfade beat-aware.
**Tests:** mood monta N stems, intensidade clampa, sem throw.

### Onda 5 — Integração adaptativa de gameplay
`computeIntensity(state, character)` puro (combate por nº/HP de inimigos, tensão de
exploração, low-HP) + wire no campaign-screen empurrando intensidade. Stingers musicais
**em tom** (level-up fanfare, descoberta, NPC reveal, troca de cena), beat-synced.
`pickAmbientMood` estendido. **Tests:** função pura de intensidade, mapeamento de mood.

### Onda 6 — Controles de UX + mix do jogador
Seção de áudio no UX Settings Modal: slider de volume da música, volume de SFX,
quantidade de reverb, master. Persistir em `ux-prefs`. Aplicar nos buses do mixer.
**Tests:** prefs persistem, volume aplica.

### Onda 7 — Polish, mix final, QA empírico + docs
Playtest no preview (real browser): `AnalyserNode` confirma sinal sem clip, sem
exceptions, contagem de nós sã; tuning de níveis. Voice cap / cleanup mobile. Harness
DEV de audição (gated `import.meta.env.DEV`, estilo `window.__nav`) pro João ouvir cada
mood/instrumento. Guards finais + `HANDOFF` + `CLAUDE.md`. `git push origin main`
(deploy = Manual do João no Render).

---

## 4. Princípios de execução
- Cada onda: `npm run typecheck` + `npm test` verdes antes do commit. Sem regressão na
  suíte (~2142 → cresce).
- Commits descritivos no padrão do projeto. Push único no fim (auto-deploy Render OFF →
  deploy continua manual do João — sem surpresa).
- Confiar no EXIT code do vitest (memória: não fiar em regex de resumo). Não misturar
  PowerShell frágil com Edits/commit no mesmo batch.
- Respeitar `prefers-reduced-motion`? Não se aplica a áudio; mas honrar mute/volume e
  battery via voice cap.
