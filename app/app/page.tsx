import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyRole } from '@/lib/auth/getMyRole'

type SP = { periodMonths?: string; minTenureMonths?: string }
type Row = {
  agent_id: string; data_entrada: string
  agents: { id: string; nome: string } | null
  parishes: { id: string; nome: string } | null
  pastoral_groups: { id: string; nome: string } | null
  roles_functions: { id: string; nome: string } | null
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function addMonthsISO(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function diffDays(fromISO: string, toISO: string) {
  const a = new Date(fromISO+'T00:00:00').getTime()
  const b = new Date(toISO+'T00:00:00').getTime()
  return Math.floor((b-a) / 86400000)
}
function formatTenure(fromISO: string) {
  const days = Math.max(0, diffDays(fromISO, todayISO()))
  if (days < 30) return `${days} dias`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mes${months===1?'':'es'}`
  const years = Math.floor(months / 12); const rem = months % 12
  return rem ? `${years} ano${years===1?'':'s'} e ${rem} mes${rem===1?'':'es'}` : `${years} ano${years===1?'':'s'}`
}

function groupCount(rows: Row[], key: 'parishes'|'pastoral_groups'|'roles_functions') {
  const map = new Map<string, { id: string; nome: string; count: number }>()
  for (const r of rows) {
    const e = r[key]; if (!e) continue
    const cur = map.get(e.id)
    if (!cur) map.set(e.id, { id: e.id, nome: e.nome, count: 1 })
    else cur.count += 1
  }
  return Array.from(map.values()).sort((a,b)=> b.count-a.count || a.nome.localeCompare(b.nome)).slice(0,10)
}

function Filters({ periodMonths, minTenureMonths }: { periodMonths: string; minTenureMonths: string }) {
  return (
    <form className="border rounded p-4 space-y-3" method="GET">
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="block text-sm mb-1">Considerar entradas nos últimos (meses)</label>
          <select className="border p-2 w-full rounded" name="periodMonths" defaultValue={periodMonths}>
            <option value="">Todos</option><option value="3">3</option><option value="6">6</option><option value="12">12</option>
          </select></div>
        <div><label className="block text-sm mb-1">Ativos há mais de (meses)</label>
          <select className="border p-2 w-full rounded" name="minTenureMonths" defaultValue={minTenureMonths}>
            <option value="">Desligado</option><option value="3">3</option><option value="6">6</option><option value="12">12</option>
          </select></div>
      </div>
      <div className="flex gap-2">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Aplicar</button>
        <a className="underline px-4 py-2" href="/app">Limpar</a>
      </div>
    </form>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const periodMonths = (sp.periodMonths ?? '').trim()
  const minTenureMonths = (sp.minTenureMonths ?? '').trim()

  const periodN = Number(periodMonths || 0)
  const tenureN = Number(minTenureMonths || 0)
  const cutoffPeriod = periodN > 0 ? addMonthsISO(todayISO(), -periodN) : null
  const cutoffTenure = tenureN > 0 ? addMonthsISO(todayISO(), -tenureN) : null

  const supabase = await createClient()
  const role = await getMyRole()
  const { data: { user } } = await supabase.auth.getUser()

  const { count: totalAgents } = await supabase.from('agents').select('id', { count: 'exact', head: true })

  let q = supabase.from('agent_movements').select(`agent_id,data_entrada,agents(id,nome),parishes(id,nome),pastoral_groups(id,nome),roles_functions(id,nome)`).is('data_saida', null)
  if (cutoffPeriod) q = q.gte('data_entrada', cutoffPeriod)
  const { data: activeMovements, error: actErr } = await q
  if (actErr) throw actErr

  const activeRows = (activeMovements ?? []) as unknown as Row[]
  const activeCount = activeRows.length
  const inactiveCount = Math.max(0, (totalAgents ?? 0) - activeCount)

  const mStart = monthStartISO()
  const mNext = addMonthsISO(mStart, 1)

  const { count: entriesThisMonth } = await supabase.from('agent_movements').select('id', { count: 'exact', head: true }).gte('data_entrada', mStart).lt('data_entrada', mNext)
  const { count: exitsThisMonth } = await supabase.from('agent_movements').select('id', { count: 'exact', head: true }).gte('data_saida', mStart).lt('data_saida', mNext)

  const byParish = groupCount(activeRows, 'parishes')
  const byPastoral = groupCount(activeRows, 'pastoral_groups')
  const byRoleFn = groupCount(activeRows, 'roles_functions')

  const topTenure = [...activeRows].sort((a,b)=> a.data_entrada.localeCompare(b.data_entrada)).slice(0,10)
  const longTenure = cutoffTenure ? activeRows.filter(r => r.data_entrada <= cutoffTenure).slice(0,50) : []

  const exportHref = `/app/reports/export?periodMonths=${encodeURIComponent(periodMonths)}&minTenureMonths=${encodeURIComponent(minTenureMonths)}`

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl"><b>Relatórios</b></h1>
        <p className="text-sm text-gray-600">Usuário: <b>{user?.email}</b> • Papel: <b>{role}</b></p>
      </div>

      <Filters periodMonths={periodMonths} minTenureMonths={minTenureMonths} />

      <section className="grid md:grid-cols-4 gap-3">
        <div className="border rounded p-4"><div className="text-sm text-gray-600">Total</div><div className="text-2xl"><b>{totalAgents ?? 0}</b></div></div>
        <div className="border rounded p-4"><div className="text-sm text-gray-600">Ativos</div><div className="text-2xl text-green-700"><b>{activeCount}</b></div></div>
        <div className="border rounded p-4"><div className="text-sm text-gray-600">Inativos</div><div className="text-2xl"><b>{inactiveCount}</b></div></div>
        <div className="border rounded p-4"><div className="text-sm text-gray-600">Mês</div><div className="text-sm">Entradas: <b>{entriesThisMonth ?? 0}</b> • Saídas: <b>{exitsThisMonth ?? 0}</b></div></div>
      </section>

      <section className="border rounded p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl"><b>Exportação</b></h2>
          <a className="bg-gray-900 text-white px-4 py-2 rounded" href={exportHref}>Baixar CSV (ativos)</a>
        </div>
        <p className="text-sm text-gray-600">O CSV respeita os filtros acima.</p>
      </section>

      <TopList title="Ativos por Paróquia (Top 10)" items={byParish} />
      <TopList title="Ativos por Pastoral/Grupo (Top 10)" items={byPastoral} />
      <TopList title="Ativos por Função/Cargo (Top 10)" items={byRoleFn} />

      <section className="border rounded p-4 space-y-3">
        <h2 className="text-xl"><b>Maior tempo na função atual (Top 10)</b></h2>
        {topTenure.length === 0 ? <p className="text-sm text-gray-600">Nenhum ativo encontrado.</p> : (
          <ul className="space-y-2">{topTenure.map(m => (
            <li key={m.agent_id} className="border rounded p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate"><b>{m.agents?.nome ?? '—'}</b></div>
                  <div className="text-sm text-gray-700">Paróquia: <b>{m.parishes?.nome ?? '-'}</b> • Pastoral: <b>{m.pastoral_groups?.nome ?? '-'}</b> • Função: <b>{m.roles_functions?.nome ?? '-'}</b></div>
                  <div className="text-sm text-gray-700">Desde: <b>{m.data_entrada}</b> • Tempo: <b>{formatTenure(m.data_entrada)}</b></div>
                </div>
                <Link className="underline shrink-0" href={`/app/agents/${m.agent_id}`}>Abrir</Link>
              </div>
            </li>
          ))}</ul>
        )}
      </section>

      {cutoffTenure && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-xl"><b>Ativos há mais de {tenureN} meses</b></h2>
          {longTenure.length === 0 ? <p className="text-sm text-gray-600">Nenhum encontrado.</p> : (
            <ul className="space-y-2">{longTenure.map(m => (
              <li key={m.agent_id} className="border rounded p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate"><b>{m.agents?.nome ?? '—'}</b></div>
                    <div className="text-sm text-gray-700">Paróquia: <b>{m.parishes?.nome ?? '-'}</b> • Pastoral: <b>{m.pastoral_groups?.nome ?? '-'}</b> • Função: <b>{m.roles_functions?.nome ?? '-'}</b></div>
                    <div className="text-sm text-gray-700">Desde: <b>{m.data_entrada}</b> • Tempo: <b>{formatTenure(m.data_entrada)}</b></div>
                  </div>
                  <Link className="underline shrink-0" href={`/app/agents/${m.agent_id}`}>Abrir</Link>
                </div>
              </li>
            ))}</ul>
          )}
        </section>
      )}
    </div>
  )
}

function TopList({ title, items }: { title: string; items: { id: string; nome: string; count: number }[] }) {
  return (
    <section className="border rounded p-4 space-y-2">
      <h2 className="text-xl"><b>{title}</b></h2>
      {items.length === 0 ? <p className="text-sm text-gray-600">Nenhum ativo encontrado.</p> : (
        <ul className="space-y-2">{items.map(x => (
          <li key={x.id} className="flex items-center justify-between border rounded p-2">
            <span className="truncate">{x.nome}</span><span className="text-sm"><b>{x.count}</b></span>
          </li>
        ))}</ul>
      )}
    </section>
  )
}

