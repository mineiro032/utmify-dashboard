const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const UTMIFY_MCP_URL = process.env.UTMIFY_MCP_URL

const SUMMARY_PROMPT = `
Você é um analista de performance de tráfego pago.
Use as ferramentas MCP do UTMify para buscar os dados reais de hoje.
Retorne APENAS um JSON válido com esta estrutura (todos os valores monetários em centavos):
{
  "faturamento": number,
  "lucro": number,
  "roi": number,
  "margem": number,
  "vendasAprovadas": number,
  "vendasPendentes": number,
  "gastoMeta": number,
  "cpa": number
}
Sem texto adicional, apenas o JSON.
`

const CAMPAIGNS_PROMPT = `
Você é um analista de performance de tráfego pago.
Use as ferramentas MCP do UTMify para buscar os dados reais das campanhas ativas de hoje.
Retorne APENAS um JSON válido: um array de objetos com esta estrutura (valores monetários em centavos):
[
  {
    "nome": string,
    "gasto": number,
    "vendas": number,
    "lucro": number,
    "roi": number,
    "cpa": number,
    "status": "vencedor" | "borderline" | "negativo",
    "orcamento": number
  }
]
Classifique status como: "vencedor" se ROI >= 200, "negativo" se ROI < 100, senão "borderline".
Sem texto adicional, apenas o JSON array.
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }) }
  }

  if (!UTMIFY_MCP_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: 'UTMIFY_MCP_URL não configurada' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) }
  }

  const { type } = body
  if (!['summary', 'campaigns'].includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'type deve ser "summary" ou "campaigns"' }) }
  }

  const prompt = type === 'summary' ? SUMMARY_PROMPT : CAMPAIGNS_PROMPT

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        mcp_servers: [
          {
            type: 'url',
            url: UTMIFY_MCP_URL,
            name: 'utmify',
          },
        ],
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return { statusCode: 502, body: JSON.stringify({ error: 'Erro na API Anthropic', detail: err }) }
    }

    const result = await response.json()

    const textContent = result.content?.find((c) => c.type === 'text')?.text ?? ''

    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) ||
                      textContent.match(/```\s*([\s\S]*?)```/) ||
                      textContent.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)

    const rawJson = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : textContent

    let parsed
    try {
      parsed = JSON.parse(rawJson.trim())
    } catch {
      console.error('Failed to parse JSON from Anthropic response:', textContent)
      return { statusCode: 502, body: JSON.stringify({ error: 'Resposta inválida da IA', raw: textContent }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: parsed }),
    }
  } catch (err) {
    console.error('Function error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
