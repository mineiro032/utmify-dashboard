import { useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = {
  brl: (cents) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  pct: (v) => `${Number(v).toFixed(1)}%`,
  num: (v) => Number(v).toLocaleString('pt-BR'),
}

function roiColor(roi) {
  if (roi >= 200) return 'var(--green)'
  if (roi >= 100) return 'var(--yellow)'
  return 'var(--red)'
}

function badge(status) {
  const map = {
    vencedor: { label: 'Vencedor', color: 'var(--green)', bg: 'var(--green-dim)' },
    negativo: { label: 'Negativo', color: 'var(--red)', bg: 'var(--red-dim)' },
    borderline: { label: 'Borderline', color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
  }
  return map[status] ?? map['borderline']
}

// ─── mock data (used until first fetch) ─────────────────────────────────────

const MOCK_SUMMARY = {
  faturamento: 1842300,
  lucro: 612400,
  roi: 237,
  margem: 33.2,
  vendasAprovadas: 148,
  vendasPendentes: 22,
  gastoMeta: 549800,
  cpa: 3715,
}

const MOCK_CAMPAIGNS = [
  { nome: 'Campanha Alpha V3', gasto: 120000, vendas: 34, lucro: 198000, roi: 265, cpa: 3529, status: 'vencedor', orcamento: 300000 },
  { nome: 'Campanha Beta Broad', gasto: 98000, vendas: 21, lucro: 87500, roi: 189, cpa: 4667, status: 'borderline', orcamento: 200000 },
  { nome: 'Retargeting 7D', gasto: 54000, vendas: 18, lucro: 142000, roi: 363, cpa: 3000, status: 'vencedor', orcamento: 100000 },
  { nome: 'Lookalike 3%', gasto: 143000, vendas: 29, lucro: 98000, roi: 168, cpa: 4931, status: 'borderline', orcamento: 250000 },
  { nome: 'Cold Traffic INT', gasto: 89000, vendas: 11, lucro: -12000, roi: 87, cpa: 8091, status: 'negativo', orcamento: 150000 },
  { nome: 'Creative Test #4', gasto: 45800, vendas: 35, lucro: 99000, roi: 316, cpa: 1309, status: 'vencedor', orcamento: 80000 },
]

const TIPS = [
  {
    icon: '⚡',
    color: 'var(--yellow)',
    bg: 'var(--yellow-dim)',
    title: 'Escale os vencedores',
    body: 'Aumente o orçamento das campanhas com ROI acima de 250% em 20% a cada 48h.',
  },
  {
    icon: '🛑',
    color: 'var(--red)',
    bg: 'var(--red-dim)',
    title: 'Pause negativos',
    body: 'Campanhas com ROI abaixo de 100% estão queimando verba — pause agora.',
  },
  {
    icon: '🔍',
    color: 'var(--blue)',
    bg: 'var(--blue-dim)',
    title: 'Teste novos criativos',
    body: 'Rotacione criativos a cada 7 dias para evitar fadiga de audiência.',
  },
  {
    icon: '📊',
    color: 'var(--purple)',
    bg: 'var(--purple-dim)',
    title: 'Acompanhe o CPA',
    body: 'Mantenha o CPA abaixo de R$ 40 para preservar margem de lucro saudável.',
  },
]

const SCALE_PLAN = [
  { week: 'Semana 1', action: 'Pausar campanhas negativas e duplicar vencedores com +20% de orçamento.' },
  { week: 'Semana 2', action: 'Lançar 3 novos criativos nos conjuntos de anúncios com melhor CTR.' },
  { week: 'Semana 3', action: 'Expandir lookalike de 1% para 3% nas campanhas vencedoras.' },
  { week: 'Semana 4', action: 'Revisar métricas e consolidar estrutura para o próximo mês.' },
]

// ─── components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 500, color: color ?? 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  )
}

function CampaignRow({ c }) {
  const b = badge(c.status)
  const roi = c.roi
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 80px 90px 80px 100px 90px',
      alignItems: 'center',
      gap: 12,
      padding: '14px 20px',
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
    }}>
      <div>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>{c.nome}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar value={c.gasto} max={c.orcamento} color={roiColor(roi)} />
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
            {fmt.brl(c.gasto)} / {fmt.brl(c.orcamento)}
          </span>
        </div>
      </div>
      <div className="mono" style={{ color: roiColor(roi), fontWeight: 600 }}>{fmt.pct(roi)}</div>
      <div className="mono">{fmt.brl(c.cpa)}</div>
      <div className="mono" style={{ color: c.lucro >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {fmt.brl(c.lucro)}
      </div>
      <div className="mono" style={{ color: 'var(--muted)' }}>{c.vendas}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{
          background: b.bg,
          color: b.color,
          border: `1px solid ${b.color}`,
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          {b.label}
        </span>
      </div>
      <div className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>{fmt.brl(c.gasto)}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#111',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.nome}</div>
      <div className="mono" style={{ color: roiColor(d.roi) }}>ROI {fmt.pct(d.roi)}</div>
      <div className="mono" style={{ color: 'var(--muted)' }}>Gasto {fmt.brl(d.gasto)}</div>
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function App() {
  const [summary, setSummary] = useState(MOCK_SUMMARY)
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumRes, camRes] = await Promise.all([
        fetch('/.netlify/functions/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'summary' }),
        }),
        fetch('/.netlify/functions/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'campaigns' }),
        }),
      ])

      if (!sumRes.ok || !camRes.ok) throw new Error('Erro ao buscar dados')

      const sumJson = await sumRes.json()
      const camJson = await camRes.json()

      setSummary(sumJson.data)
      setCampaigns(camJson.data)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const roiChartData = campaigns.map((c) => ({ nome: c.nome.split(' ').slice(0, 2).join(' '), roi: c.roi, gasto: c.gasto }))

  return (
    <div style={{ minHeight: '100vh', padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Facebook Ads Dashboard
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {lastUpdate ? `Atualizado às ${lastUpdate}` : 'Dados de demonstração — clique em Atualizar'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && (
            <span style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-dim)', padding: '6px 12px', borderRadius: 8 }}>
              {error}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            style={{
              background: loading ? 'var(--border)' : 'var(--green)',
              color: loading ? 'var(--muted)' : '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Carregando…
              </>
            ) : '⟳ Atualizar'}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <MetricCard label="Faturamento" value={fmt.brl(summary.faturamento)} sub={`${fmt.num(summary.vendasAprovadas)} vendas aprovadas`} color="var(--text)" icon="💰" />
        <MetricCard label="Lucro" value={fmt.brl(summary.lucro)} sub={`Margem ${fmt.pct(summary.margem)}`} color="var(--green)" icon="📈" />
        <MetricCard label="ROI" value={fmt.pct(summary.roi)} sub="Retorno sobre investimento" color={roiColor(summary.roi)} icon="🎯" />
        <MetricCard label="Gasto Meta" value={fmt.brl(summary.gastoMeta)} sub="Total investido no período" color="var(--text)" icon="📣" />
        <MetricCard label="CPA" value={fmt.brl(summary.cpa)} sub="Custo por aquisição médio" color="var(--yellow)" icon="🛒" />
        <MetricCard label="Pendentes" value={fmt.num(summary.vendasPendentes)} sub="Aguardando aprovação" color="var(--orange)" icon="⏳" />
      </div>

      {/* Campaigns table */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Campanhas</h2>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{campaigns.length} campanhas ativas</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 80px 90px 80px 100px 90px',
          gap: 12,
          padding: '8px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          <div>Campanha</div>
          <div>ROI</div>
          <div>CPA</div>
          <div>Lucro</div>
          <div>Vendas</div>
          <div>Status</div>
          <div>Gasto</div>
        </div>
        {campaigns.map((c, i) => <CampaignRow key={i} c={c} />)}
      </section>

      {/* ROI chart */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>ROI por Campanha</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={roiChartData} barSize={32} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="nome" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
              {roiChartData.map((entry, i) => (
                <Cell key={i} fill={roiColor(entry.roi)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tips + Scale plan */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>

        {/* Tips */}
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Dicas de Otimização</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TIPS.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: t.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  {t.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: t.color, marginBottom: 2 }}>{t.title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>{t.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Scale plan */}
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Plano de Escala — 4 Semanas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {SCALE_PLAN.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--green-dim)', border: '1px solid var(--green)',
                  color: 'var(--green)', fontWeight: 700, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{s.week}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>{s.action}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
