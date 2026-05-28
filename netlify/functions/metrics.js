const UTMIFY_MCP_URL = process.env.UTMIFY_MCP_URL

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'MCP-Protocol-Version': '2024-11-05',
}

async function callMcpTool(toolName, args) {
  const res = await fetch(UTMIFY_MCP_URL, {
    method: 'POST',
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MCP ${toolName} HTTP ${res.status}: ${text}`)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(`MCP ${toolName} error: ${JSON.stringify(json.error)}`)
  }

  const content = json.result?.content
  if (!Array.isArray(content)) {
    throw new Error(`MCP ${toolName}: resposta sem content`)
  }

  const text = content.find((c) => c.type === 'text')?.text ?? ''

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`MCP ${toolName}: content não é JSON válido — ${text.slice(0, 200)}`)
  }
}

function brtDateString(date) {
  const brt = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const y = brt.getFullYear()
  const m = String(brt.getMonth() + 1).padStart(2, '0')
  const d = String(brt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayRange() {
  const d = brtDateString(new Date())
  return { start: `${d}T00:00:00-03:00`, end: `${d}T23:59:59-03:00` }
}

function last7DaysRange() {
  const now = new Date()
  const sevenAgo = new Date(now)
  sevenAgo.setDate(sevenAgo.getDate() - 6)
  return {
    start: `${brtDateString(sevenAgo)}T00:00:00-03:00`,
    end: `${brtDateString(now)}T23:59:59-03:00`,
  }
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return 0
}

function extractDashboardId(raw) {
  if (!raw) return null
  if (raw.dashboardId) return raw.dashboardId
  if (raw.id) return raw.id
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]
    return first.dashboardId ?? first.id ?? null
  }
  if (raw.dashboards && Array.isArray(raw.dashboards) && raw.dashboards.length > 0) {
    const first = raw.dashboards[0]
    return first.dashboardId ?? first.id ?? null
  }
  return null
}

function mapSummary(raw) {
  return {
    faturamento: pick(raw, 'faturamento', 'revenue', 'totalRevenue', 'receita'),
    lucro: pick(raw, 'lucro', 'profit', 'lucroLiquido'),
    roi: pick(raw, 'roi', 'ROI'),
    margem: pick(raw, 'margem', 'margin', 'margemLucro'),
    vendasAprovadas: pick(raw, 'vendasAprovadas', 'approvedSales', 'approvedOrders', 'vendas'),
    vendasPendentes: pick(raw, 'vendasPendentes', 'pendingSales', 'pendingOrders'),
    gastoMeta: pick(raw, 'gastoMeta', 'metaSpend', 'adSpend', 'spend', 'gasto'),
    cpa: pick(raw, 'cpa', 'CPA', 'costPerAcquisition'),
  }
}

function mapCampaign(c) {
  const roi = pick(c, 'roi', 'ROI')
  const status = roi >= 200 ? 'vencedor' : roi < 100 ? 'negativo' : 'borderline'
  return {
    nome: pick(c, 'nome', 'name', 'campaignName') || 'Campanha',
    gasto: pick(c, 'gasto', 'spend', 'cost', 'adSpend'),
    vendas: pick(c, 'vendas', 'sales', 'purchases', 'conversions', 'approvedSales'),
    lucro: pick(c, 'lucro', 'profit'),
    roi,
    cpa: pick(c, 'cpa', 'CPA', 'costPerAcquisition'),
    status,
    orcamento: pick(c, 'orcamento', 'budget', 'dailyBudget', 'totalBudget'),
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
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

  try {
    const dashboardsRaw = await callMcpTool('get_dashboards', {})
    const dashboardId = extractDashboardId(dashboardsRaw)

    if (!dashboardId) {
      console.error('get_dashboards response:', JSON.stringify(dashboardsRaw))
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Nenhum dashboard encontrado', raw: dashboardsRaw }),
      }
    }

    let data

    if (type === 'summary') {
      const raw = await callMcpTool('get_dashboard_summary', {
        dashboardId,
        dateRange: todayRange(),
      })
      data = mapSummary(raw)
    } else {
      const raw = await callMcpTool('get_meta_ad_objects', {
        dashboardId,
        level: 'campaign',
        dateRange: last7DaysRange(),
      })
      const items = Array.isArray(raw)
        ? raw
        : raw?.campaigns ?? raw?.data ?? raw?.items ?? []
      data = items.map(mapCampaign)
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    }
  } catch (err) {
    console.error('metrics function error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
