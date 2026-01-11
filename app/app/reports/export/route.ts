import { createClient } from '@/lib/supabase/server'

function csvCell(v: any) {
  const s = String(v ?? '')
  const needs = /[",\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needs ? `"${escaped}"` : escaped
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addMonthsISO(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const periodMonths = (url.searchParams.get('periodMonths') ?? '').trim()
  const minTenureMonths = (url.searchParams.get('minTenureMonths') ?? '').trim()

  const periodN = Number(periodMonths || 0)
  const tenureN = Number(minTenureMonths || 0)

  const cutoffPeriod = periodN > 0 ? addMonthsISO(todayISO(), -periodN) : null
  const cutoffTenure = tenureN > 0 ? addMonthsISO(todayISO(), -tenureN) : null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  let q = supabase
    .from('agent_movements')
    .select(
      `
      agent_id,data_entrada,
      agents(id,nome),
      parishes(id,nome),
      pastoral_groups(id,nome),
      roles_functions(id,nome)
    `
    )
    .is('data_saida', null)

  if (cutoffPeriod) q = q.gte('data_entrada', cutoffPeriod)
  if (cutoffTenure) q = q.lte('data_entrada', cutoffTenure)

  const { data, error } = await q
  if (error) return new Response(error.message, { status: 500 })

  const header = [
    'agent_id',
    'agente_nome',
    'paroquia',
    'pastoral_grupo',
    'funcao_cargo',
    'data_entrada',
  ]

  const lines = [header.join(',')]

  for (const r of (data ?? []) as any[]) {
    const line = [
      csvCell(r.agent_id),
      csvCell(r.agents?.nome),
      csvCell(r.parishes?.nome),
      csvCell(r.pastoral_groups?.nome),
      csvCell(r.roles_functions?.nome),
      csvCell(r.data_entrada),
    ].join(',')
    lines.push(line)
  }

  const csv = '\uFEFF' + lines.join('\n') // BOM para abrir bem no Excel
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="agentes_ativos.csv"',
    },
  })
}