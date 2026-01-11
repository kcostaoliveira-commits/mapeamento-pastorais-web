import { createClient } from '@/lib/supabase/server'
import { getMyRole } from '@/lib/auth/getMyRole'
import { AgentDetailForm } from './ui'

type LookupItem = { id: string; nome: string }

type Movement = {
  id: string
  agent_id: string
  data_entrada: string
  data_saida: string | null
  observacoes: string | null
  created_at: string
  parishes: LookupItem | null
  pastoral_groups: LookupItem | null
  roles_functions: LookupItem | null
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getMyRole()

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id,nome,data_nascimento,endereco,contato,email,observacoes,created_at')
    .eq('id', id)
    .single()

  if (agentError || !agent) {
    return (
      <div className="p-6 space-y-2">
        <p><b>Agente não encontrado.</b></p>
        <p className="text-sm text-gray-600">ID: <b>{id}</b></p>
        <p className="text-sm text-gray-600">Erro: <b>{agentError?.message || 'sem mensagem'}</b></p>
        <a href="/app/agents" className="text-blue-600 underline">Voltar</a>
      </div>
    )
  }

  const { data: movementsRaw, error: movError } = await supabase
    .from('agent_movements')
    .select(`
      id, agent_id, data_entrada, data_saida, observacoes, created_at,
      parishes ( id, nome ),
      pastoral_groups ( id, nome ),
      roles_functions ( id, nome )
    `)
    .eq('agent_id', id)
    .order('data_entrada', { ascending: false })

  if (movError) throw movError

  const normalizeLookup = (v: any): LookupItem | null => {
    if (!v) return null
    if (Array.isArray(v)) return v[0] ?? null
    return v
  }

  const movements: Movement[] = (movementsRaw ?? []).map((m: any) => ({
    id: m.id,
    agent_id: m.agent_id,
    data_entrada: m.data_entrada,
    data_saida: m.data_saida,
    observacoes: m.observacoes,
    created_at: m.created_at,
    parishes: normalizeLookup(m.parishes),
    pastoral_groups: normalizeLookup(m.pastoral_groups),
    roles_functions: normalizeLookup(m.roles_functions),
  }))

  const { data: parishes, error: parErr } = await supabase
    .from('parishes')
    .select('id,nome')
    .order('nome', { ascending: true })
  if (parErr) throw parErr

  const { data: pastoralGroups, error: pgErr } = await supabase
    .from('pastoral_groups')
    .select('id,nome')
    .order('nome', { ascending: true })
  if (pgErr) throw pgErr

  const { data: rolesFunctions, error: rfErr } = await supabase
    .from('roles_functions')
    .select('id,nome')
    .order('nome', { ascending: true })
  if (rfErr) throw rfErr

  return (
    <AgentDetailForm
      agent={agent}
      role={role}
      movements={movements}
      lookups={{
        parishes: parishes ?? [],
        pastoralGroups: pastoralGroups ?? [],
        rolesFunctions: rolesFunctions ?? [],
      }}
    />
  )
}