# Fase 2 — Contingência de streaming + tool calls (decidir ANTES de codar)

> O `PLANO_REVIRAVOLTA.md` exige resolver esta contingência **antes** de ligar
> streaming, porque é onde o bug **V.2** ("DM narra lindo mas o combate NUNCA
> inicia" — toolCalls perdidas) renasce. Este doc registra o que a leitura do
> código revelou e a decisão.

## Achado central (leitura do código, não suposição)

O streaming "ingênuo" (mandar os chunks crus do provider pro client) **NÃO funciona**
nesta arquitetura, por 3 razões verificadas em `src/server/dm/`:

1. **A narração vem embrulhada em JSON.** O `SYSTEM_PROMPT` (`prompts.ts:257`)
   manda o LLM "RESPONDA EM JSON": `{"narration": "...", "speaker": "..."}`. Os
   chunks crus seriam `{"narration": "Vocês entr...` aparecendo char a char na cara
   do jogador. `extractJson` (`dm.ts:471`) só extrai a narração do texto COMPLETO.

2. **Pós-processamento roda no texto inteiro, não incremental** (`dm.ts:144-237`):
   - `stripInlineToolMentions` — corta vazamento "+ tool start_combat(...)".
   - **Fog-of-war linter** — sanitiza HP/CA/DC do oponente. Roda no texto cheio;
     um chunk poderia exibir "o orc tem 8 HP" ANTES da sanitização.
   - **retry-sem-tools** (recovery do V.2 / BUG-001) — quando o LLM devolve
     narração VAZIA + toolCalls (comum em Groq/Gemini com `mode=auto`), o código
     re-chama SEM tools e usa as `originalToolCalls` snapshotadas. Isso pressupõe
     uma resposta única **bufferizada** de onde se extrai narração E tools.

3. **Streaming cru quebraria a premissa do retry** e poderia vazar JSON, menção de
   tool e número de oponente — exatamente os 3 modos de falha que o núcleo já
   blinda hoje no caminho bufferizado.

## Decisão de design (quando ligar o streaming de token de verdade)

**"Preview best-effort + final autoritativo".** O stream é só uma PRÉVIA; a
verdade continua sendo a resposta bufferizada já blindada:

- O provider ganha `generateStream(opts, onChunk)` que **acumula tudo** e devolve
  o MESMO `DMRawResponse {text, toolCalls}` que `generate()` devolveria. O
  pós-processamento de `narrate()` fica **idêntico** (V.2/strip/fog/retry intactos).
- Um extrator incremental no server lê só o VALOR do campo `narration` do JSON
  conforme cresce e emite os deltas LIMPOS via novo evento `dmNarrationChunk`.
- No fim, o `dmNarration` final (sanitizado, pós-fog, pós-retry) é emitido como
  **autoridade** e o client SUBSTITUI a prévia por ele. Assim:
  - fog-flash some (o final corrige);
  - stream vazio + toolCalls → retry roda e seu texto vira o final (sem texto duplo);
  - **V.2 permanece resolvido** (toda a lógica opera no buffer final, não no stream).
- Cobrir com os **goldens da Fase 1c** (start_combat com narração vazia, vitória →
  XP) ANTES de ligar em prod.

> Risco residual: o extrator incremental de JSON (escapes em fronteira de chunk) +
> 3 providers (Groq/Cerebras SSE OpenAI-style, Gemini). É a parte que "reborns V.2"
> e precisa de gate de deploy + validação no celular do João. Por isso é a ÚLTIMA
> etapa da Fase 2, não a primeira.

## O que entra AGORA (seguro, alto valor, ataca a dor exata, sem mexer no provider)

A dor do João é "esperar DUAS vezes". Estas 3 alavancas matam a SEGUNDA espera e o
beat-2 morto **sem o risco do streaming de token** — e estão na lista da Fase 2:

1. **Matar o typewriter FALSO** (`narration-log.ts:935`, 80 char/s sobre texto já
   recebido). A narração aparece inteira na hora que chega, em vez de ser
   re-digitada por ~2.5s. Remove a segunda espera.
2. **Shimmer otimista no toque** — `isDmThinking` + shimmer no MESMO frame do tap,
   sem esperar o eco `dmThinking` do servidor (mata o round-trip pro spinner).
3. **Beat instantâneo no skill-check** — veredito local visceral (SUCESSO/FALHA,
   cor + SFX) a partir de `success/nat20/nat1` que JÁ vem no `diceRollResult`,
   antes da narração do Mestre. Mata o silêncio do beat 2.

E **enxugar o tool-set por modo + cortar redundância do prompt** reduz a PRIMEIRA
espera (menos tokens = geração mais rápida + mais quota) — risco médio, testável.

## Resumo

O streaming de token cru é a parte de MAIOR risco da Fase 2 (a que reborns V.2) e
exige o design "preview + final autoritativo" acima + 3 providers + extrator
incremental + gate de deploy. As 3 alavancas de percepção (typewriter/otimista/
beat) entregam a maior parte do ganho percebido AGORA, com risco baixo. Sequência:
levar as alavancas seguras → (decisão do João no gate) → streaming de token com o
design documentado, coberto pelos goldens, validado no celular.
