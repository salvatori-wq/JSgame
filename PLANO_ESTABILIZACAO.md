# JSgame · Plano de Estabilização — "Menos é Mais"

> Escrito depois que o João entrou no jogo e achou: som horrível, narração
> robótica, menu confuso, "patinando". Avaliação técnica franca + plano de
> subtração. **Veredito: o jogo VALE — mantém. Os problemas são de superfície
> e excesso, não de fundação.**

## Por que mantém (e não mata)

O **núcleo é bom de verdade** (confirmado dirigindo o jogo + auditoria):
- Log de narração + chips de ação contextuais + dado animado = um bom loop de D&D.
- Motor D&D correto (combate, magia, saves, descanso, level-up — Rules Lawyer
  conferiu contra o PHB). A parte difícil funciona.

Os problemas são **3 coisas consertáveis**, não um motor podre. Matar seria jogar
fora um motor que funciona.

## O erro de método que nos trouxe aqui (assumido)

As sessões anteriores mediram **testes headless + contagem de commits** ("2300
verde, 9.4/10") em vez da **experiência de quem joga**. Daí o abismo: relatório
verde, jogo ruim na mão. **Nova régua: o João joga e aprova. Sem "verde" sem ele
ver.** Cada fase termina com você jogando.

## Os 3 problemas reais (com evidência de playtest)

1. **Som "horrível" = música generativa LIGADA por padrão.** Auto-ligava em toda
   campanha. É um drone de serra (sawtooth) + melodia aleatória em quintas
   paralelas, em loop por 30 min. Engenharia impressionante, produto ruim. As 7
   "Ondas" provaram que *tem som e não distorce* — nunca que *soa bem*. Efeitos
   (dado) são bons; o problema é só a música.

2. **Narração robótica + lixo na tela = Mestre IA caindo no fallback.** No
   playtest: LLM falhou (groq auth + Gemini 503) → texto canned ("tenta e falha.
   O mundo registra. Anda.") + linha crua "percepcao (DC 12): rolou 4 → FALHOU".

3. **Menu confuso = 3 gerações de UI empilhadas, 2 são CÓDIGO MORTO.**
   `bottom-tab-bar.ts` e `action-dock-topics.ts` (~570 linhas, com testes) **nunca
   são chamados**. E há **DOIS menus "⋯ Mais"** diferentes (rodapé ~15-19 itens +
   topo 8 itens), com duplicatas e jargão ("Memória (RAG)"). Por isso o "Mais" não
   é útil — virou gaveta de tranqueira.

## O plano (subtrair, não somar) — fases pequenas, você aprova cada uma

### ✅ Fase 0 — Parar o sangramento (FEITO, commit `cedfa9e`)
- **Música OFF por padrão** (efeitos seguem ON). Provado no browser.
- **Echo do dado limpo**: "Percepção 11 — falhou" (era "percepcao (DC 12): rolou
  4 → FALHOU"). Sem slug, sem DC, sem CAIXA ALTA. Idem saves.
- **Fallback com cor**: templates offline reescritos pra cena viva.
- tsc limpo, testes verdes. **→ João joga e confirma o som/echo.**

### Fase 1 — Limpar a confusão (subtração pura, baixo risco)
- **Deletar os 2 sistemas de UI mortos** (`bottom-tab-bar.ts`,
  `action-dock-topics.ts` + método não-chamado + testes). ~570 linhas, zero
  mudança pro jogador, fim da pergunta "qual sistema tá no ar?".
- **Fundir os 2 menus "⋯ Mais" em UM só** organizado por seção:
  **Personagem** (Inventário, Magia, Descansos) · **Crônica** (Missões, NPCs,
  Glórias, Convite) · **Ajustes** (1 entrada → modal UX que já existe; Sons/
  Música/Notif/Voz viram toggles lá dentro, não popover por sessão).
- **Tirar "Memória (RAG)"** da cara do jogador (é ferramenta de dev).
- Tirar duplicata de Glossário; "Tela"/"Ajustes" viram um nome só.
- **→ João joga e confirma que o menu faz sentido.**

### Fase 2 — Música boa de verdade (zero-budget)
- Trocar o gerador procedural por **4-6 loops medievais CC0** (grátis:
  OpenGameArt CC0 / Incompetech CC-BY com crédito / Tabletop Audio). OGG pequeno
  (~1-2 MB cada, lazy por mood). **Reusa a lógica de mood/intensidade que já
  existe e é boa** (`pickAmbientMood` + `music-intensity.ts`). Mantém o reverb/
  compressor (bons) e os efeitos.
- Aí sim a **música default volta a ON** (porque vai soar bem).
- **→ João escuta e aprova o timbre/nível.**

### Fase 3 — Confiabilidade do Mestre
- Garantir failover de verdade (Cerebras já tem chave em prod) pra parar de cair
  no fallback. Em prod as chaves existem; o Gemini free dá 503 — o cascade tem
  que pular pro próximo sem o jogador sentir.
- Só então: **sessão real de 30 min validada pelo João jogando** (a régua do
  "pronto pra lançar").

## O que NÃO vamos fazer
- Nada de mais uma maratona de 7 sprints de "polish".
- Nada de medir sucesso por contagem de teste sem o João ver.
- Nada de adicionar feature nova antes do núcleo estar limpo e estável.

## Núcleo que se mantém (não mexer — é o que funciona)
- `narration-log.ts` (log de narração) + `updateSuggestedChips` (chips).
- Motor D&D: `combat.ts`, `spells-engine.ts`, `leveling.ts`, `rest-handler.ts`.
- `mixer.ts` (reverb/compressor) + `audio.ts` (efeitos).
- Lógica de mood/intensidade (`pickAmbientMood`, `music-intensity.ts`).
