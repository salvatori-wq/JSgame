# Handoff · Trilha Sonora "Bardo" (medieval adaptativa) — 2026-05-31

## O que foi feito

Reescrita completa da trilha sonora do JSgame: de "gerador de textura ambiente"
para **compositor medieval generativo adaptativo**. 100% procedural (Web Audio,
zero asset, zero budget — respeita a decisão consolidada do projeto). Plano em
[PLANO_TRILHA_SONORA.md](PLANO_TRILHA_SONORA.md). Pesquisa de fundo (formas de
dança, modos, recipes DSP) guiou cada decisão.

7 ondas, 7 commits, **+110 tests** (suíte 2142→2252 verde, zero regressão).

| Onda | Commit | Entrega |
|---|---|---|
| 1 | `87fbc4d` | `mixer.ts` (reverb IR procedural hall/cave/tavern/cathedral + compressor + lowpass mestre de "energia") + `theory.ts` (organum, cadências ouvert/clos, RNG seedável, walk modal) + limiter mestre |
| 2 | `59adeb7` | 12 instrumentos: alaúde, vielle, recorder, shawm, saltério, harpa, tabor, bodhrán, nakers, sino de igreja (parciais inarmônicos), hurdy buzz + ornamentos (trinado/mordente/apojatura) |
| 3 | `<este>`* | `composer.ts` (melodia generativa A·A'·B·A'' com cadências) + `themes.ts` (leitmotif "A Estrada do Mestre" + fanfarra + lamento) + 7 grooves de dança |
| 4 | `a8eff95` | moods em camadas adaptativas (drone/ritmo/melodia/harmonia) + `setAmbientIntensity()` + `intensity.ts` + 11 moods |
| 5 | `b54619d` | `computeIntensity(state)` + wire no campaign-screen (combate sobe, exploração respira) + stingers musicais em tom (level-up, troca de cena) |
| 6 | `49a6a7c` | sliders de volume Música/Efeitos/Reverb no UX Settings + bus de SFX separado |
| 7 | `<este>` | harness DEV `window.__audio` + QA empírico no preview + fix do drone mudo + docs |

(* a Onda 3 foi commitada como `feat(trilha): Onda 3`.)

## Prova empírica (preview real, via AnalyserNode)

Como o ambiente é headless (não escuto), medi o sinal no master com `window.__audio.measure()`:

| Mood | RMS | Peak | Clipping |
|---|---|---|---|
| exploration-calm | 0.058 | 0.149 | não |
| combat-skirmish | 0.066 | 0.169 | não |
| combat-boss | 0.075 | 0.211 | não |
| mystery | 0.070 | 0.167 | não |
| tavern | 0.061 | 0.201 | não |
| danger-low-hp | 0.092 | 0.178 | não |
| silence | 0.004 | 0.01 | — |

- **Há som** em todos os moods (RMS não-zero); **intensidade escala** (exploração < skirmish < boss);
  **zero clipping** (peaks ≤0.21, longe de 1.0; + limiter mestre de backup);
  silêncio zera; stinger eleva o sinal (+0.098 peak); instrumento isolado soa; **zero erro de console**.

## Arquivos-chave (mapa)

```
src/client/audio/theory.ts       # organum, cadências, RNG seedável, walk modal
src/client/audio/mixer.ts        # reverb IR + compressor + lowpass de energia
src/client/audio/instruments.ts  # 12 instrumentos + ornamentos + padDrone (fix)
src/client/audio/composer.ts     # melodia generativa + grooves de dança
src/client/audio/themes.ts       # leitmotif assinatura + fanfarra + lamento
src/client/audio/intensity.ts    # curvas de camadas por intensidade
src/client/audio/ambient.ts      # 11 moods em camadas + setAmbientIntensity + stingers
src/client/audio/audition.ts     # harness DEV window.__audio (gated import.meta.env.DEV)
src/client/campaign/music-intensity.ts  # computeIntensity(state) puro
```

## Como o João avalia (ele ESCUTA — eu não)

No dev (`npm run dev`, http://localhost:5173), abrir o console e:

```js
await __audio.resume();          // desbloqueia o áudio (precisa de 1 clique antes)
__audio.list();                  // moods + instrumentos disponíveis
__audio.mood('combat-boss');     // troca a trilha
__audio.intensity(0.9);          // 0..1 — combate sobe, exploração respira
__audio.stinger('level-up');     // fanfarra
__audio.inst('shawm', 392);      // audiciona um instrumento isolado
await __audio.measure(800);      // {rms, peak} do master
```

Moods: exploration-calm/tension, combat-skirmish/boss, danger-low-hp, mystery,
rest, shop, tavern, sacred, travel, victory.

## Pendências / próximos passos

- **Feedback de ouvido do João**: ajustar timbres/níveis/tempos por mood ao gosto
  (o harness `__audio` torna isso rápido). Pontos prováveis de tuning: nasalidade
  do shawm (boss), volume relativo da percussão, brilho do reverb da catedral.
- **Deploy**: auto-deploy do Render está OFF → **Manual Deploy do João** (push já feito).
- Opcional: mapear `sacred`/`travel`/`tavern` a tags de cena no `pickAmbientMood`
  (hoje só acessíveis via harness; o builder genérico já os toca).
- Opcional: stingers de `discovery`/`npc` (já existem em `playStinger`, faltam wires).
