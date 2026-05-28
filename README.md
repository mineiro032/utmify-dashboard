# UTMify Dashboard — Facebook Ads

Dashboard de métricas do Facebook Ads integrado com UTMify via MCP e Claude AI.

## Stack

- React 18 + Vite 5
- Recharts (gráficos)
- Netlify Functions (backend serverless)
- Anthropic API com MCP Client (acesso ao UTMify)

## Deploy na Netlify

### 1. Fork / clone e conecte ao Netlify

Importe o repositório no [app.netlify.com](https://app.netlify.com) ou use a CLI:

```bash
npm install -g netlify-cli
netlify login
netlify init
```

### 2. Configure as variáveis de ambiente

No painel da Netlify → **Site Settings → Environment Variables**, adicione:

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Sua chave da API Anthropic (começa com `sk-ant-...`) |
| `UTMIFY_MCP_URL` | URL do servidor MCP do UTMify fornecida pela plataforma |

Para desenvolvimento local, crie um arquivo `.env` na raiz:

```env
ANTHROPIC_API_KEY=sk-ant-...
UTMIFY_MCP_URL=https://mcp.utmify.com.br/...
```

### 3. Deploy

```bash
# Deploy de produção
netlify deploy --prod

# Ou via git push (se CI/CD configurado)
git push origin main
```

### 4. Desenvolvimento local

```bash
npm install
netlify dev   # inicia Vite + Netlify Functions localmente
```

Acesse `http://localhost:8888`.

## Como funciona

O botão **Atualizar** dispara dois POSTs para `/.netlify/functions/metrics`:

- `{ type: "summary" }` → retorna métricas consolidadas (faturamento, lucro, ROI…)
- `{ type: "campaigns" }` → retorna array de campanhas com performance individual

A função serverless chama a API Anthropic com o header `mcp-client-2025-04-04` e passa o servidor MCP do UTMify, permitindo que Claude consulte os dados reais de vendas e anúncios diretamente.

## Estrutura

```
├── src/
│   ├── App.jsx          # Dashboard principal
│   ├── main.jsx         # Entry point
│   └── index.css        # Tema dark
├── netlify/
│   └── functions/
│       └── metrics.js   # Serverless function (Anthropic + MCP)
├── index.html
├── vite.config.js
└── netlify.toml
```
