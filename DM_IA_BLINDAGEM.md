# JSgame · Blindagem do Mestre IA — análise profunda

> Como deixar a IA do JSgame **funcional, inteligente, GRÁTIS e à prova de pane**.
> Data: 2026-05-26. Estado: cascade Gemini→Groq já em prod (commit 5dc96e5).

---

## 1. Diagnóstico — onde estamos vs onde queremos

### Estado atual (pós-deploy de hoje)

| Camada | Implementado | Limitação |
|---|---|---|
| 2 providers em cascade (Gemini + Groq) | ✓ failover automático | Se ambos rate-limit no mesmo dia, app cai pro fallback offline ("Mestre travou no éter") |
| Timeout 35s, 2 tentativas | ✓ cobre Groq lento sob carga | Em pico, prompts complexos (NPC interaction) ainda passam de 35s |
| Safety blocks tratados como retriable | ✓ Gemini bloqueia → Groq tenta | Groq também pode bloquear D&D-violência (mais raro) |
| Logging estruturado por failover | ✓ debug pós-deploy | Sem dashboard tempo real |

### Limitações dos providers atuais

**Google Gemini 2.5 Flash (free)**:
- 1500 req/dia, 15 RPM (1 req a cada 4s)
- Quota é por API key e zera meia-noite Pacific Time
- Em sessão coop 3 players × 30 min × 1 ação/30s = ~180 req → 1 sessão consome 12% da quota diária
- **Risco**: 8 sessões/dia esgotam Gemini

**Groq Llama 3.3 70B (free)**:
- 14.4K req/dia, 30 RPM, 6K TPM (tokens per minute) input
- Mais generoso em volume, mas **latência variável**: 5-30s
- Em horário de pico US (~14h-22h BRT), TPM caps às vezes batem
- **Risco**: latência > timeout (35s) em narrações com muito context

**Pior caso atual**: Gemini esgota → Groq lento ou TPM cap → degraded UI.

---

## 2. Providers gratuitos adicionais — análise

Procurando providers para somar ao cascade, priorizando:
1. Free tier sem cartão de crédito
2. Suporte a modelo decente (≥7B params, idealmente 70B)
3. Sem auto-bill (estoura quota → retorna 429, não cobra surpresa)
4. Disponibilidade global / sem geo-block

### Tier 1 — Adicionar JÁ (zero atrito)

#### **Cerebras Cloud** ⭐ recomendação top
- **URL**: https://cloud.cerebras.ai
- **Modelos**: Llama 3.1 70B, Llama 3.3 70B, Qwen 3 32B
- **Free tier**: 30 RPM, 60K TPM, 1M tokens/dia
- **Velocidade**: **~2000 tokens/segundo** (literalmente o mais rápido do mercado — Groq é ~600)
- **Por que**: latência consistente <3s, complementa Groq em qualidade narrativa
- **Como obter**: signup com email, dashboard gera key. ~30 segundos.

#### **Cloudflare Workers AI**
- **URL**: https://dash.cloudflare.com/sign-up/workers-and-pages
- **Modelos**: Llama 3.1 70B Instruct, Llama 3.3 70B, Qwen 2.5 32B, Mistral 7B
- **Free tier**: 10K neurons/dia (~500-1000 calls dependendo do modelo)
- **Velocidade**: 5-10s típico
- **Por que**: infra Cloudflare = uptime ridículo, geograficamente distribuído
- **Como obter**: signup Cloudflare → Workers AI → API token. ~2 min.

#### **OpenRouter (aggregator)**
- **URL**: https://openrouter.ai
- **Modelos free**: Llama 3.2 11B, Llama 3.2 3B, Mistral 7B, Gemma 2 9B, Phi-3
- **Free tier**: ~200 req/dia em modelos gratuitos
- **Por que**: meta-aggregator — uma API key, acesso a 100+ modelos. Útil como **plano D** quando os principais 3 falham.
- **Como obter**: signup → API key. Tem free credits também.

### Tier 2 — Considerar (mais atrito mas robusto)

#### **HuggingFace Inference API**
- 1K req/mês free (serverless Llama, Qwen)
- Latência alta (5-15s cold start)
- Útil só como fallback de emergência

#### **Mistral La Plateforme**
- Free tier 1 req/segundo, Mistral Large
- Cadastro precisa SMS verification (atrito)

#### **Pollinations.AI**
- 100% grátis, sem cadastro
- Mas: sem garantia de uptime, "best effort"
- Útil como ÚLTIMO recurso

### Tier 3 — Quase-grátis (pago micro-budget)

#### **DeepSeek**
- $0.14/M input tokens (DeepSeek V3 — top tier)
- $1 cobre ~7M tokens ≈ ~5000 narrações
- Sem cadastro pagante até a quota acabar
- Excelente reasoning, ideal pra D&D complexo

#### **Claude Haiku (Anthropic)**
- $0.25/M input tokens
- Pode setar budget cap de $5/mês
- Latência <3s consistente
- Pra coop com 4+ players seria game-changer

---

## 3. Arquitetura proposta — Cascade de 5 camadas

```
┌─────────────────────────────────────────────────────────┐
│  Player ação → DungeonMaster.narrate()                  │
├─────────────────────────────────────────────────────────┤
│  CascadeProvider tenta em ordem:                        │
│                                                          │
│  1. ⚡ Cerebras Llama 3.3 70B    (2000 tok/s)           │
│     Free: 30 RPM, 1M tokens/dia                          │
│                                                          │
│  2. ✨ Gemini 2.5 Flash          (qualidade narrativa)   │
│     Free: 1500 req/dia, 15 RPM                           │
│                                                          │
│  3. 🏃 Groq Llama 3.3 70B        (já temos)             │
│     Free: 14.4K req/dia, 30 RPM                          │
│                                                          │
│  4. ☁️  Cloudflare Workers AI     (uptime god-tier)      │
│     Free: 10K neurons/dia                                │
│                                                          │
│  5. 🌐 OpenRouter (Gemma-2 9B)   (último recurso AI)    │
│     Free: ~200 req/dia                                   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  6. 📜 Template-based offline narrator                  │
│     200+ templates por mood/action/scene                 │
│     SEM IA — gera narração plausível sem trava          │
└─────────────────────────────────────────────────────────┘
```

**Capacidade combinada (sem otimização)**:
- Cerebras: ~30K calls/dia
- Gemini: 1500/dia
- Groq: 14.4K/dia
- Cloudflare: ~1000/dia
- OpenRouter: ~200/dia
- **Total: ~47K calls/dia gratuitas**

Em sessões coop intensas (180 calls/sessão), isso cobre **~260 sessões/dia**. Mais que suficiente.

---

## 4. Inteligência adicional — não só failover

### 4.1 Circuit breaker por provider
Se provider X falha 3 vezes em 1 min, desabilita por 5 min. Cascade pula direto pro próximo. Evita gastar timeout em provider quebrado.

### 4.2 Daily quota tracking em memória
Conta requests por provider/dia. Quando passa de 80% do limit conhecido, marca como "saturated" e empurra pro fim da fila. Quem ainda tem budget vai primeiro.

### 4.3 Smart routing por tipo de ação
- Ação **simples** (explorar, investigar): Cerebras primeiro (rápido, modelo OK)
- Ação **complexa** (falar com NPC, combate boss): Gemini primeiro (melhor narrativa)
- **Background** (summarize, recap): qualquer um (não é hot path)

### 4.4 Prompt slim mode
System prompt atual ~3K tokens (lista 7 tools + persona D&D + regras). 
- **Slim mode**: 1.5K tokens — tools opt-in (só passa quando ação requer), persona em 3 linhas
- **40% redução de input tokens** → menos quota consumida, menos chance de 413

### 4.5 Response caching
Cache key = `hash(systemPrompt + lastNarrationFingerprint + action + dmPersonality)`.
- Hit rate esperado: ~15-20% em sessões coop (mesma ação repetida)
- TTL 30 min (dentro de uma sessão)
- Economiza ~30% das chamadas em playtests longos

### 4.6 Local template narrator (camada 6)
Quando tudo falha, em vez de "Mestre travou":
- Gerador procedural com 200+ templates por (mood × action × scene)
- Mood vem do CampaignState.dmPersonality
- Action vem do player
- Scene vem do currentLocation
- Result: narração **plausível** que mantém o jogo rodando

Exemplo:
```
mood: sombrio
action: explorar
scene: taverna
→ "Você varre o ambiente com os olhos. {{ambient_detail}}. {{npc_observation}}. {{tension_hint}}."

Onde {{}} são picks de pools temáticos:
ambient_detail: ["O cheiro de cerveja velha gruda na roupa", "Uma vela bruxuleia no canto", ...]
npc_observation: ["O barman te ignora de propósito", "Dois caras no fundo trocam olhares", ...]
tension_hint: ["Algo aqui não bate", "Você sente que vai dar merda", ...]
```

Resultado: o jogador não percebe quando IA cai. Sessão continua.

---

## 5. Roadmap concreto

### Fase 1 — Ampliar cascade (2h) [BIGGEST UNLOCK]

**Tasks**:
1. Implementar `CerebrasProvider` (igual ao GeminiProvider, troca URL/body)
2. Implementar `CloudflareWorkersAIProvider`
3. Atualizar `factory.ts` pra incluir os 4 providers
4. Tests do CerebrasProvider + CF integration test

**Keys necessárias**:
- `CEREBRAS_API_KEY` — você precisa criar em https://cloud.cerebras.ai
- `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` — você precisa criar em https://dash.cloudflare.com

**Impacto**: capacidade de 16K → 47K calls/dia (3×). Praticamente impossível esgotar tudo.

### Fase 2 — Resilience inteligente (2h)

**Tasks**:
1. Circuit breaker (`provider-health.ts` — tracking de failures por provider)
2. Quota counter (`provider-budget.ts` — request count + reset por dia)
3. Smart routing por action complexity
4. Health endpoint `/api/dm/health` retornando rankings

**Sem novas keys**.

### Fase 3 — Local fallback inteligente (3h)

**Tasks**:
1. Template engine (`server/dm/templates/`)
2. 200+ templates por mood/action/scene combination
3. Substituir `makeGracefulFallback` por template-narrator
4. Tests cobrindo cada combinação mood × action

**Sem novas keys**.

### Fase 4 — Otimizações (1-2h)

**Tasks**:
1. Slim system prompt (40% redução)
2. Response cache em memória
3. Dashboard observability simples

---

## 6. Recomendação executiva

**Faça Fase 1 hoje**:
- Você ganha 3 providers novos
- Cerebras é **brutal** em velocidade (vai virar default de fato)
- Free total: ~47K calls/dia — impossível esgotar
- Tempo: ~2h de coding + você cria 2 keys (Cerebras + Cloudflare)

**Deixa Fase 2 e 3 pra depois**:
- Fase 1 sozinha já te dá uptime ridículo
- Fase 2/3 polishes pra escalar pra muitos players
- Fase 4 é otimização pura

**Pra começar agora preciso**:
1. Confirmar: faz Fase 1?
2. Você cria as 2 keys (te mando link clicável + screenshot do que fazer)
3. Me passa as keys (ou adiciona direto no Render env e me avisa)
4. Eu implemento + deploy + valida

---

## 7. Provider keys — passo a passo

### Cerebras (recomendado #1)
1. Acesse https://cloud.cerebras.ai
2. Sign up com Google ou email
3. Dashboard → API Keys → Generate
4. Copia a key
5. Adiciona no Render: env var `CEREBRAS_API_KEY`

### Cloudflare Workers AI
1. Acesse https://dash.cloudflare.com/sign-up
2. Cria conta (free)
3. Sidebar → Workers & Pages → AI
4. "Create API Token" → template "Workers AI:Read"
5. Anota tanto `Account ID` (visível no dashboard) quanto o `API Token`
6. Adiciona no Render: env vars `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`

### OpenRouter (opcional, Fase 4)
1. Acesse https://openrouter.ai
2. Sign up
3. Dashboard → Keys → Create
4. Copia
5. Render: `OPENROUTER_API_KEY`

---

## 8. Resumo TLDR

| Métrica | Hoje | Após Fase 1 | Após Fase 3 |
|---|---|---|---|
| Providers IA | 2 | 4 | 5 |
| Capacidade/dia gratuita | ~16K calls | ~47K calls | ~47K calls |
| Uptime estimado | ~95% | ~99.5% | **100% (template fallback)** |
| Latência média | 8-30s | 3-15s | 3-15s |
| Quando trava o jogo? | Quota dupla rara | Quota quíntupla impossível | **Nunca** |
| Custo mensal | $0 | $0 | $0 |
