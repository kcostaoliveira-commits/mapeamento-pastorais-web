import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyRole } from '@/lib/auth/getMyRole'
import { canEdit } from '@/lib/auth/can'

type SearchParams = {
  q?: string
  onlyActive?: string
  parishId?: string
  pastoralGroupId?: string
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const onlyActive = sp.onlyActive === '1'
  const parishId = (sp.parishId ?? '').trim()
  const pastoralGroupId = (sp.pastoralGroupId ?? '').trim()

  const role = await getMyRole()
  const supabase = await createClient()

  // Lookups para os filtros
  const [{ data: parishes, error: parErr }, { data: pastoralGroups, error: pgErr }] =
    await Promise.all([
      supabase.from('parishes').select('id,nome').order('nome', { ascending: true }),
      supabase.from('pastoral_groups').select('id,nome').order('nome', { ascending: true }),
    ])

  if (parErr) throw parErr
  if (pgErr) throw pgErr

  // 1) Buscar IDs de agentes ATIVOS (e opcionalmente filtrados por paróquia/pastoral)
  let activeAgentIds: string[] | null = null

  if (onlyActive || parishId || pastoralGroupId) {
    let movementsQuery = supabase
      .from('agent_movements')
      .select(
        `
        agent_id,
        parishes ( id, nome ),
        pastoral_groups ( id, nome ),
        roles_functions ( id, nome ),
        data_entrada,
        data_saida
      `
      )
      .is('data_saida', null)

    if (parishId) movementsQuery = movementsQuery.eq('parish_id', parishId)
    if (pastoralGroupId) movementsQuery = movementsQuery.eq('pastoral_group_id', pastoralGroupId)

    const { data: activeMovements, error: amErr } = await movementsQuery
    if (amErr) throw amErr

    activeAgentIds = Array.from(new Set((activeMovements ?? []).map((m) => m.agent_id)))

    // Se o filtro exige ativos (ou filtro por paróquia/pastoral) e não há ninguém, já retorna vazio
    if (activeAgentIds.length === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl"><b>Agentes</b></h1>
            {canEdit(role) && (
              <Link className="bg-blue-600 text-white px-4 py-2 rounded" href="/app/agents/new">
                Novo agente
              </Link>
            )}
          </div>

          <Filters
            q={q}
            onlyActive={onlyActive}
            parishId={parishId}
            pastoralGroupId={pastoralGroupId}
            parishes={parishes ?? []}
            pastoralGroups={pastoralGroups ?? []}
          />

          <p className="text-sm text-gray-600">Nenhum agente encontrado para os filtros selecionados.</p>
        </div>
      )
    }
  }

  // 2) Buscar agentes (com busca por nome e, se necessário, restringindo aos IDs ativos filtrados)
  let agentsQuery = supabase
    .from('agents')
    .select('id,nome,contato,email,data_nascimento')
    .order('nome', { ascending: true })

  if (q) agentsQuery = agentsQuery.ilike('nome', `%${q}%`)
  if (activeAgentIds) agentsQuery = agentsQuery.in('id', activeAgentIds)

  const { data: agents, error: agErr } = await agentsQuery
  if (agErr) throw agErr

  const agentIds = (agents ?? []).map((a) => a.id)

  // 3) Puxar movimentação ativa DE TODOS os agentes retornados (para exibir status/contexto)
  //    (mesmo quando onlyActive = false, isso ajuda a mostrar "Ativo/Inativo")
  let activeByAgentId = new Map<string, any>()

  if (agentIds.length > 0) {
    const { data: activeMovs, error: actErr } = await supabase
      .from('agent_movements')
      .select(
        `
        agent_id,
        data_entrada,
        parishes ( id, nome ),
        pastoral_groups ( id, nome ),
        roles_functions ( id, nome )
      `
      )
      .in('agent_id', agentIds)
      .is('data_saida', null)

    if (actErr) throw actErr

    ;(activeMovs ?? []).forEach((m) => {
      activeByAgentId.set(m.agent_id, m)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl"><b>Agentes</b></h1>
        {canEdit(role) && (
          <Link className="bg-blue-600 text-white px-4 py-2 rounded" href="/app/agents/new">
            Novo agente
          </Link>
        )}
      </div>

      <Filters
        q={q}
        onlyActive={onlyActive}
        parishId={parishId}
        pastoralGroupId={pastoralGroupId}
        parishes={parishes ?? []}
        pastoralGroups={pastoralGroups ?? []}
      />

      <ul className="space-y-2">
        {(agents ?? []).map((a) => {
          const active = activeByAgentId.get(a.id) ?? null

          return (
            <li key={a.id} className="border rounded p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate"><b>{a.nome}</b></div>

                    {active ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        Inativo
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600">
                    {(a.contato || '')}{a.email ? ` • ${a.email}` : ''}
                  </div>

                  {active && (
                    <div className="text-sm text-gray-700 mt-1 space-y-1">
                      <div>
                        Paróquia: <b>{active.parishes?.nome ?? '-'}</b> • Pastoral: <b>{active.pastoral_groups?.nome ?? '-'}</b> • Função: <b>{active.roles_functions?.nome ?? '-'}</b>
                      </div>
                      <div>
                        Tempo na função: <b>{formatDurationSince(active.data_entrada)}</b> (desde <b>{active.data_entrada}</b>)
                      </div>
                    </div>
                  )}
                </div>

                <Link className="underline shrink-0" href={`/app/agents/${a.id}`}>
                  Abrir
                </Link>
              </div>
            </li>
          )
        })}
      </ul>

      {(agents ?? []).length === 0 && (
        <p className="text-sm text-gray-600">Nenhum agente encontrado.</p>
      )}
    </div>
  )
}

/* ====================== Filtros (Server Component inline) ====================== */
function Filters({
  q,
  onlyActive,
  parishId,
  pastoralGroupId,
  parishes,
  pastoralGroups,
}: {
  q: string
  onlyActive: boolean
  parishId: string
  pastoralGroupId: string
  parishes: { id: string; nome: string }[]
  pastoralGroups: { id: string; nome: string }[]
}) {
  return (
    <form className="border rounded p-4 space-y-3" method="GET">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Buscar por nome</label>
          <input
            className="border p-2 w-full rounded"
            name="q"
            defaultValue={q}
            placeholder="Ex.: Maria, João..."
          />
        </div>

        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="onlyActive" value="1" defaultChecked={onlyActive} />
            <span className="text-sm">Somente ativos</span>
          </label>

          <a className="text-sm underline ml-auto" href="/app/agents">
            Limpar filtros
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Filtrar por Paróquia (movimentação ativa)</label>
          <select className="border p-2 w-full rounded" name="parishId" defaultValue={parishId}>
            <option value="">Todas</option>
            {parishes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Filtrar por Pastoral/Grupo (movimentação ativa)</label>
          <select className="border p-2 w-full rounded" name="pastoralGroupId" defaultValue={pastoralGroupId}>
            <option value="">Todas</option>
            {pastoralGroups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          Aplicar
        </button>
      </div>
    </form>
  )
}


function diffInDays(fromISO: string, toISO: string) {
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function todayISO() {
  const dt = new Date()
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDurationSince(fromISO: string) {
  const days = diffInDays(fromISO, todayISO())
  if (days < 0) return '0 dias'
  if (days < 30) return `${days} dias`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} мес${months === 1 ? '' : 'es'}`

  const years = Math.floor(months / 12)
  const remMonths = months % 12

  if (remMonths === 0) return `${years} ano${years === 1 ? '' : 's'}`
  return `${years} ano${years === 1 ? '' : 's'} e ${remMonths} mes${remMonths === 1 ? '' : 'es'}`
}