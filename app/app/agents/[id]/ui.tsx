'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canEdit, isAdmin } from '@/lib/auth/can'

type Role = 'admin' | 'cadastrador' | 'consulta' | null

type Agent = {
  id: string
  nome: string | null
  data_nascimento: string | null
  endereco: string | null
  contato: string | null
  email: string | null
  observacoes: string | null
  created_at: string
}

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

function calcAge(isoDate: string | null) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return null

  const today = new Date()
  let age = today.getFullYear() - y
  const mm = today.getMonth() + 1
  const dd = today.getDate()

  if (mm < m || (mm === m && dd < d)) age -= 1
  return age >= 0 ? age : null
}

function todayISO() {
  const dt = new Date()
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function AgentDetailForm({
  agent,
  role,
  movements,
  lookups,
}: {
  agent: Agent
  role: Role
  movements: Movement[]
  lookups: {
    parishes: LookupItem[]
    pastoralGroups: LookupItem[]
    rolesFunctions: LookupItem[]
  }
}) {
  const [formData, setFormData] = useState({
    nome: agent.nome ?? '',
    data_nascimento: agent.data_nascimento ?? '',
    endereco: agent.endereco ?? '',
    contato: agent.contato ?? '',
    email: agent.email ?? '',
    observacoes: agent.observacoes ?? '',
  })

  const [movementForm, setMovementForm] = useState({
    parish_id: '',
    pastoral_group_id: '',
    role_function_id: '',
    data_entrada: '',
    observacoes: '',
  })

  const [endOpen, setEndOpen] = useState(false)
  const [endDate, setEndDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const editable = canEdit(role)
  const admin = isAdmin(role)

  const activeMovement = useMemo(
    () => movements.find((m) => !m.data_saida) || null,
    [movements]
  )

  const age = useMemo(() => calcAge(formData.data_nascimento || null), [formData.data_nascimento])

  function handleAgentChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSaveAgent() {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          nome: formData.nome,
          data_nascimento: formData.data_nascimento || null,
          endereco: formData.endereco || null,
          contato: formData.contato || null,
          email: formData.email || null,
          observacoes: formData.observacoes || null,
        })
        .eq('id', agent.id)

      if (error) return alert(error.message)

      router.refresh()
      alert('Agente salvo com sucesso.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAgent() {
    const ok = confirm('Tem certeza que deseja excluir este agente? Esta ação é irreversível.')
    if (!ok) return

    setBusy(true)
    try {
      const { error } = await supabase.from('agents').delete().eq('id', agent.id)
      if (error) return alert(error.message)

      router.push('/app/agents')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleStartMovement() {
    if (activeMovement) {
      return alert('Já existe uma movimentação ativa. Encerre a atual para iniciar outra.')
    }

    if (
      !movementForm.parish_id ||
      !movementForm.pastoral_group_id ||
      !movementForm.role_function_id ||
      !movementForm.data_entrada
    ) {
      return alert('Preencha: Paróquia, Pastoral/Grupo, Função/Cargo e Data de Entrada.')
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('agent_movements').insert({
        agent_id: agent.id,
        parish_id: movementForm.parish_id,
        pastoral_group_id: movementForm.pastoral_group_id,
        role_function_id: movementForm.role_function_id,
        data_entrada: movementForm.data_entrada,
        observacoes: movementForm.observacoes || null,
      })

      if (error) return alert(error.message)

      setMovementForm({
        parish_id: '',
        pastoral_group_id: '',
        role_function_id: '',
        data_entrada: '',
        observacoes: '',
      })
      router.refresh()
      alert('Movimentação iniciada.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmEndMovement() {
    if (!activeMovement) return

    if (!endDate) return alert('Informe a data de saída.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return alert('Data de saída inválida. Use AAAA-MM-DD.')

    if (endDate < activeMovement.data_entrada) {
      return alert('A data de saída não pode ser menor que a data de entrada.')
    }

    setBusy(true)
    try {
      const { error } = await supabase
        .from('agent_movements')
        .update({ data_saida: endDate })
        .eq('id', activeMovement.id)

      if (error) return alert(error.message)

      setEndOpen(false)
      setEndDate(todayISO())
      router.refresh()
      alert('Movimentação encerrada.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* ====================== Dados do Agente ====================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">
            <b>Detalhe do agente</b>
          </h1>
          <a className="underline" href="/app/agents">
            Voltar
          </a>
        </div>

        <div className="border rounded p-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Nome</label>
            <input
              className="border p-2 w-full rounded"
              name="nome"
              value={formData.nome}
              onChange={handleAgentChange}
              disabled={!editable || busy}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Data de nascimento</label>
              <input
                className="border p-2 w-full rounded"
                type="date"
                name="data_nascimento"
                value={formData.data_nascimento}
                onChange={handleAgentChange}
                disabled={!editable || busy}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Idade (calculada)</label>
              <input className="border p-2 w-full rounded bg-gray-50" value={age ?? ''} disabled />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Endereço</label>
            <input
              className="border p-2 w-full rounded"
              name="endereco"
              value={formData.endereco}
              onChange={handleAgentChange}
              disabled={!editable || busy}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Contato</label>
            <input
              className="border p-2 w-full rounded"
              name="contato"
              value={formData.contato}
              onChange={handleAgentChange}
              disabled={!editable || busy}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              className="border p-2 w-full rounded"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleAgentChange}
              disabled={!editable || busy}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Observações</label>
            <textarea
              className="border p-2 w-full rounded min-h-24"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleAgentChange}
              disabled={!editable || busy}
            />
          </div>

          <div className="flex gap-2 pt-2">
            {editable && (
              <button
                type="button"
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                onClick={handleSaveAgent}
                disabled={busy}
              >
                Salvar
              </button>
            )}

            {admin && (
              <button
                type="button"
                className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-60"
                onClick={handleDeleteAgent}
                disabled={busy}
              >
                Excluir
              </button>
            )}
          </div>

          {!editable && (
            <p className="text-sm text-gray-600">
              Você está em modo <b>consulta</b>. Edição desabilitada.
            </p>
          )}
        </div>
      </div>

      {/* ====================== Movimentações ====================== */}
      <div className="space-y-4">
        <h2 className="text-xl">
          <b>Movimentações (Histórico)</b>
        </h2>

        {/* Status atual */}
        <div className="border rounded p-4 space-y-3">
          {activeMovement ? (
            <>
              <div className="space-y-1">
                <p>
                  Situação atual: <b>Ativo</b>
                </p>
                <p className="text-sm text-gray-700">
                  Paróquia: <b>{activeMovement.parishes?.nome || '-'}</b> • Pastoral/Grupo:{' '}
                  <b>{activeMovement.pastoral_groups?.nome || '-'}</b> • Função/Cargo:{' '}
                  <b>{activeMovement.roles_functions?.nome || '-'}</b>
                </p>
                <p className="text-sm text-gray-700">
                  Data de Entrada: <b>{activeMovement.data_entrada}</b>
                </p>
              </div>

              {editable && !endOpen && (
                <button
                  type="button"
                  className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-60"
                  onClick={() => setEndOpen(true)}
                  disabled={busy}
                >
                  Encerrar movimentação
                </button>
              )}

              {editable && endOpen && (
                <div className="border rounded p-3 space-y-2">
                  <div>
                    <label className="block text-sm mb-1">Data de Saída</label>
                    <input
                      className="border p-2 w-full rounded"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={busy}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-60"
                      onClick={handleConfirmEndMovement}
                      disabled={busy}
                    >
                      Confirmar encerramento
                    </button>
                    <button
                      type="button"
                      className="border px-4 py-2 rounded disabled:opacity-60"
                      onClick={() => {
                        setEndOpen(false)
                        setEndDate(todayISO())
                      }}
                      disabled={busy}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p>
              Situação atual: <b>Sem movimentação ativa</b>
            </p>
          )}
        </div>

        {/* Form iniciar movimentação */}
        {editable && (
          <div className="border rounded p-4 space-y-3">
            <h3 className="text-lg">
              <b>Iniciar nova movimentação</b>
            </h3>

            {activeMovement && (
              <p className="text-sm text-gray-600">
                Existe uma movimentação ativa. Para iniciar outra, encerre a atual primeiro.
              </p>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Paróquia</label>
                <select
                  className="border p-2 w-full rounded"
                  value={movementForm.parish_id}
                  onChange={(e) => setMovementForm((p) => ({ ...p, parish_id: e.target.value }))}
                  disabled={busy || !!activeMovement}
                >
                  <option value="">Selecione...</option>
                  {lookups.parishes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Pastoral/Grupo</label>
                <select
                  className="border p-2 w-full rounded"
                  value={movementForm.pastoral_group_id}
                  onChange={(e) =>
                    setMovementForm((p) => ({ ...p, pastoral_group_id: e.target.value }))
                  }
                  disabled={busy || !!activeMovement}
                >
                  <option value="">Selecione...</option>
                  {lookups.pastoralGroups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Função/Cargo</label>
                <select
                  className="border p-2 w-full rounded"
                  value={movementForm.role_function_id}
                  onChange={(e) =>
                    setMovementForm((p) => ({ ...p, role_function_id: e.target.value }))
                  }
                  disabled={busy || !!activeMovement}
                >
                  <option value="">Selecione...</option>
                  {lookups.rolesFunctions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Data de Entrada</label>
                <input
                  className="border p-2 w-full rounded"
                  type="date"
                  value={movementForm.data_entrada}
                  onChange={(e) => setMovementForm((p) => ({ ...p, data_entrada: e.target.value }))}
                  disabled={busy || !!activeMovement}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Observações</label>
              <textarea
                className="border p-2 w-full rounded min-h-20"
                value={movementForm.observacoes}
                onChange={(e) => setMovementForm((p) => ({ ...p, observacoes: e.target.value }))}
                disabled={busy || !!activeMovement}
              />
            </div>

            <button
              type="button"
              className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-60"
              onClick={handleStartMovement}
              disabled={busy || !!activeMovement}
            >
              Iniciar movimentação
            </button>
          </div>
        )}

        {/* Lista de histórico */}
        <div className="border rounded p-4 space-y-3">
          <h3 className="text-lg">
            <b>Histórico</b>
          </h3>

          {movements.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="space-y-2">
              {movements.map((m) => (
                <li key={m.id} className="border rounded p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <b>{m.parishes?.nome || '-'}</b> • {m.pastoral_groups?.nome || '-'} •{' '}
                        {m.roles_functions?.nome || '-'}
                      </div>
                      <div className="text-sm text-gray-700">
                        Entrada: <b>{m.data_entrada}</b> • Saída: <b>{m.data_saida || '—'}</b>
                      </div>
                      {m.observacoes && (
                        <div className="text-sm text-gray-700">
                          Obs.: <b>{m.observacoes}</b>
                        </div>
                      )}
                    </div>
                    <div className="text-sm shrink-0">
                      {m.data_saida ? (
                        <span className="text-gray-600">Encerrado</span>
                      ) : (
                        <span className="text-green-700">
                          <b>Ativo</b>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!editable && (
          <p className="text-sm text-gray-600">
            Você está em modo <b>consulta</b>. Não é possível iniciar/encerrar movimentações.
          </p>
        )}
      </div>
    </div>
  )
}