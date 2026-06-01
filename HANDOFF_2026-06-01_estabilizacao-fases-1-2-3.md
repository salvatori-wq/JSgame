# Handoff — Estabilização "Menos é Mais" (Fases 1, 2, 3 autônomas)

## 1. Estado atual

2026-06-01. Tudo limpo, sem pendência de código. Fase 0 entregue e pushada
(`origin/main` = `8a671d3`, suíte 100% verde). As Fases 1-3 estão escritas em
`PLANO_ESTABILIZACAO.md` — prontas pra próxima sessão executar em ciclos
autônomos. Régua nova e inegociável: **o João joga e aprova cada fase; nada de
"verde" sem ele ver.**

## 2. O que foi feito nesta sessão

1. **Avaliação técnica franca** (o João achou o jogo bugado/confuso/som horrível,
   quase desistiu). Dirigi o jogo de verdade + 2 auditores honestos (áudio + UX).
   **Veredito: MANTÉM. Núcleo bom; problemas são superfície e excesso.**
2. **Diagnóstico dos 3 problemas reais** (com prova de playtest, não achismo):
   (a) som horrível = música generativa ON por padrão; (b) narração robótica +
   "percepcao (DC 12): rolou 4 → FALHOU" = Mestre caindo no fallback + echo cru;
   (c) menu confuso = 3 gerações de UI empilhadas (2 mortas) + 2 menus "Mais".
3. **Fase 0 — stop the bleeding** (commit `cedfa9e`, provado no browser):
   música OFF por padrão (efeitos seguem ON); echo do dado limpo ("Percepção 11
   — falhou"); FallbackDM com templates de cena viva.
4. **Fix de teste stale** (`9622595`): guard do confetti z-index (9700→10001) que
   já estava quebrado em prod desde o Ciclo H. Suíte 2267 verde.
5. **`PLANO_ESTABILIZACAO.md`** (`8a671d3`): veredito + 4 fases + núcleo a preservar.

## 3. Contexto técnico relevante

- **Meu erro de método (a raiz do "patinando"):** sessões anteriores mediram
  testes headless + commits ("2300 verde, 9.4/10") em vez da experiência de jogo.
  Daí o abismo. **Reproduzir no jogo real antes de declarar pronto.** O harness
  empírico (preview headless) está documentado em `LAUNCH_QA_STRATEGY.md` §3.
- **Áudio — a decisão técnica (auditor sênior):** o motor de música procedural
  (`src/client/audio/{ambient,composer,instruments,theory,sequencer}.ts`) é
  engenharia competente mas **produto ruim** — drone sawtooth + melodia random-walk
  em quintas paralelas, seeded (toca a mesma sequência toda sessão), sem
  humanização, fatiga em 1 min. As "7 Ondas" mediram "tem som / não clippa", nunca
  "soa bem". **Preservar e reusar:** `mixer.ts` (reverb/compressor — bom),
  `audio.ts` (efeitos/dado — curtos e bons), `pickAmbientMood` (campaign-screen.ts)
  + `music-intensity.ts` (lógica de mood/intensidade — boa). **Jogar fora:**
  composer/theory/instruments sintetizados. Caminho: Fase 2 (loops CC0).
- **UI morta confirmada (Fase 1):** `createBottomTabBar` (`bottom-tab-bar.ts`) tem
  ZERO referências fora do próprio arquivo/teste — código morto. `action-dock-topics.ts`
  é importado em `campaign-screen.ts:71` e o método `renderActionDockTopics`
  (linha 1233) existe, mas `FASE6_CACA_BUGS.md:119` já documentou que o método
  NUNCA é chamado. **Verificar antes de deletar** (grep do call-site real), mas a
  expectativa é ~570 linhas de UI morta + testes.
- **Os 2 menus "Mais"** a fundir (campaign-screen.ts): `openToolsSheet` (1395, no
  rodapé `⋯`, ~15-19 itens) + `openHeaderOverflow` (1711, no toque da status-ribbon,
  8 itens). Glossário aparece nos dois; "Tela"/"Ajustes" são o mesmo modal com 2
  nomes; "Memória (RAG)" é jargão de dev a esconder.
- **Mestre caindo no fallback:** em dev o cascade groq→gemini falha (groq auth +
  Gemini 503 free). Em prod as chaves existem (`/api/health` mostra hasGemini/
  hasGroq/hasCerebras true). Fase 3 = garantir o failover pular pro Cerebras sem o
  jogador sentir. `render.yaml:38-50` tem as 4 keys como placeholders.
- **Quirks do ambiente desta sessão:** LAG de buffer (resultados de tool atrasam
  ~1 turno, às vezes vêm truncados) + **sessão de áudio concorrente** commitando no
  mesmo `main` e fazendo rebase (hashes mudam). Mitigação: escrever resultado em
  arquivo e ler (`> /tmp/x; cat`); verificar commits por CONTEÚDO no HEAD (não por
  hash); commitar com caminhos explícitos (nunca `git add -A`); **nunca editar de
  paráfrase de agente — reler o arquivo real antes** (errei isso ~3x nesta sessão;
  os Edits falharam sem dano, mas custou tempo).
- **Memórias do João** (`C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/`):
  `feedback_interface_alma` (UX é a alma — relevantíssimo agora),
  `feedback_zero_budget` (só free tier — Fase 2 usa CC0), `feedback_powershell_batch_trap`
  (confiar no EXIT do vitest), `feedback_evidencia_deploy` (Render free pula
  auto-deploy). Ler antes de agir.

## 4. Fix/padrão central

Echo de dado limpo em PT-BR (replicável em qualquer label voltado ao jogador) —
`src/server/sockets/connection.ts`:

```ts
import { SKILLS, type SkillId } from '../../dnd/skills.js';
import { ABILITY_LABELS, type AbilityKey } from '../../dnd/attributes.js';
function skillLabel(id: string): string {
  return SKILLS[id as SkillId]?.name ?? (id.charAt(0).toUpperCase() + id.slice(1));
}
// NUNCA exibir o DC interno nem CAIXA ALTA de teste no echo:
//   text: `${skillLabel(pending.skill)} ${result.roll.total} — ${verdict}`
```

Música default OFF — `src/client/audio/ambient.ts`: o parse de `ambientEnabled`
retorna `false` quando localStorage não tem a chave (era `true`).

## 5. Follow-ups sugeridos

As 3 fases são o trabalho. Ordem em `PLANO_ESTABILIZACAO.md`. Cada uma termina com
o João jogando e aprovando antes da próxima.

- [ ] **(João, primeiro) Validar a Fase 0** — entrar no jogo (local `npm run dev`
      ou Manual Deploy do `8a671d3`) e confirmar: silêncio na entrada + echo limpo
      ("Percepção X — falhou") + fallback menos robótico.
- [ ] **Fase 1 — Limpar a confusão** (subtração, baixo risco): deletar UI morta
      (`bottom-tab-bar.ts` + `action-dock-topics.ts` + método 1233 + testes, após
      confirmar por grep que não rodam) + fundir os 2 menus "Mais" em 1 só
      (Personagem / Crônica / Ajustes) + esconder "Memória (RAG)".
- [ ] **Fase 2 — Música boa** (zero-budget): trocar o gerador procedural por 4-6
      loops medievais CC0 (OpenGameArt CC0 / Incompetech CC-BY) lazy por mood,
      reusando `pickAmbientMood` + `music-intensity.ts` + `mixer.ts`. Aí a música
      volta a ON por padrão.
- [ ] **Fase 3 — Confiabilidade do Mestre**: garantir failover (Cerebras) pra
      parar de cair no fallback + sessão real de 30 min validada pelo João.
- [ ] **(deferidos herdados, não bloqueantes)** combate: 2ª arma soma mod ao dano
      (PHB p.195), magia ignora vantagem por condição; coop resiliência (restart
      perde party, joinCampaign sem watchdog, etc) — ver checklist em
      `LAUNCH_QA_STRATEGY.md` §4.

## 6. Arquivos-chave tocados (Fase 0)

- `C:\Users\JOÃO\JSgame\src\client\audio\ambient.ts` — música OFF por padrão (linha ~49).
- `C:\Users\JOÃO\JSgame\src\server\sockets\connection.ts` — echo do dado/save limpo (skillLabel/ABILITY_LABELS/rollVerdictLabel; ~464 e ~526).
- `C:\Users\JOÃO\JSgame\src\server\dm\dm.ts` — FAIL_TEMPLATES + ACTION_TEMPLATES reescritos (~603).
- `C:\Users\JOÃO\JSgame\src\server\__tests__\skill-echo-ptbr.test.ts` — NOVO, guard do echo PT-BR.
- `C:\Users\JOÃO\JSgame\src\client\__tests__\audio-sprint-x.test.ts` — atualizado pro default OFF.
- `C:\Users\JOÃO\JSgame\src\client\__tests__\sprint-y-css.test.ts` — guard confetti z-index 10001.
- `C:\Users\JOÃO\JSgame\PLANO_ESTABILIZACAO.md` — NOVO, o plano mestre (veredito + 4 fases).
- **Não tocar (núcleo bom):** `narration-log.ts`, `combat.ts`, `spells-engine.ts`,
  `leveling.ts`, `mixer.ts`, `audio.ts`, `pickAmbientMood`, `music-intensity.ts`.

## 7. Deploy / ambiente

- `origin/main` = `8a671d3` (Fase 0 inclusa). **Render auto-deploy OFF** → o João
  dá **Manual Deploy → "Deploy latest commit"**. Cold-start hiberna.
- ⚠️ **Sessão de áudio ("trilha/Onda") commita no mesmo `main` em paralelo e faz
  rebase** — o HEAD pode ter avançado; sempre usar o latest. **Não dar
  `git reset --hard`/force no main.** Verificar meus commits por assunto/conteúdo,
  não por hash.
- `npm run dev` (5173+3001) · `npx tsc --noEmit` · `npx vitest run` (confiar no
  EXIT, não no resumo — singleFork vaza `body.*` entre arquivos: tests de CSS
  flakam no full-run mas passam isolados). Commit via Bash here-doc (PowerShell
  quebra aspas).

## 8. 🎯 O que falar na próxima conversa

**Opção curta (rodar as 3 fases em autônomo, sem decidir nada):**
> Lê o `PLANO_ESTABILIZACAO.md`, o `HANDOFF_2026-06-01_estabilizacao-fases-1-2-3.md` e o `CLAUDE.md` do JSgame (em `C:\Users\JOÃO\JSgame`). Executa a estabilização "Menos é Mais" de forma AUTÔNOMA, na ordem: Fase 1 (limpar UI morta + fundir os 2 menus "Mais") → Fase 2 (trocar a música generativa por loops medievais CC0 zero-budget) → Fase 3 (confiabilidade do Mestre). Reproduz no jogo real antes de declarar pronto, commit por fix com caminhos explícitos, suíte verde + tsc limpo, e me diz o hash no fim pra eu jogar e dar o veredito de cada fase. Decisões executivas — não me pergunta a cada passo. Cuidado: tem uma sessão de áudio commitando no mesmo main em paralelo (faz rebase) — nunca dar reset/force, verificar commits por conteúdo.

**Opções específicas (se quiser mirar uma fase):**

1. **Fase 1 — Limpar a confusão (menu + código morto):**
   > Roda a Fase 1 do `PLANO_ESTABILIZACAO.md` no JSgame: confirma por grep que `bottom-tab-bar.ts` e o método `renderActionDockTopics` (campaign-screen.ts:1233) + `action-dock-topics.ts` são código morto, deleta com os testes, e funde os 2 menus "Mais" (`openToolsSheet` ~1395 + `openHeaderOverflow` ~1711) num só organizado (Personagem / Crônica / Ajustes), escondendo "Memória (RAG)". Reproduz no preview, commit por fix, suíte verde. No fim me dá o hash pra eu jogar.

2. **Fase 2 — Música boa (loops CC0 zero-budget):**
   > Roda a Fase 2 do `PLANO_ESTABILIZACAO.md` no JSgame: substitui o motor de música generativa (composer/theory/instruments) por 4-6 loops medievais CC0 (OpenGameArt CC0 / Incompetech CC-BY com crédito), lazy por mood, reusando `pickAmbientMood` + `music-intensity.ts` + `mixer.ts` (não mexer nos efeitos do `audio.ts`). Depois religa a música por padrão. Me diz como escutar pra eu aprovar timbre/nível.

3. **Fase 3 — Confiabilidade do Mestre:**
   > Roda a Fase 3 do `PLANO_ESTABILIZACAO.md` no JSgame: garante o failover do cascade LLM (groq→gemini→cerebras) pra parar de cair no FallbackDM quando o Gemini free dá 503, confirma as keys em prod (`/api/health`), e dirige uma sessão real de ~30 min no preview pra validar que o Mestre se mantém. Reproduz, commit por fix, me dá o hash.

Começa com a Opção curta se não tiver certeza — eu leio o plano e toco as 3 fases na ordem, parando pra você jogar e aprovar cada uma. Se já souber qual fase quer, vai direto numa das 3.
