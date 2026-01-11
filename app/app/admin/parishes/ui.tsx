'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Item = { id: string; nome: string }
type TableName = 'parishes' | 'pastoral_groups' | 'roles_functions'

export function AdminLookupCrud({
  title,
  tableName,
  items: initialItems,
}: {
  title: string
  tableName: TableName
  items: Item[]
}) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [nome, setNome] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function sortByNome(list: Item[]) {
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome))
  }

  async function handleCreate() {
    if (!nome.trim()) return alert('Informe o nome.')

    const { data, error } = await supabase
      .from(tableName)
      .insert({ nome: nome.trim() })
      .select('id,nome')
      .single()

    if (error) return alert(error.message)

    setItems(sortByNome([...items, data]))
    setNome('')
    router.refresh()
  }

  async function handleEdit(id: string) {
    const current = items.find((i) => i.id === id)
    if (!current) return

    const novoNome = prompt('Novo nome:', current.nome)
    if (!novoNome || !novoNome.trim() || novoNome.trim() === current.nome) return

    const { error } = await supabase.from(tableName).update({ nome: novoNome.trim() }).eq('id', id)
    if (error) return alert(error.message)

    setItems(sortByNome(items.map((i) => (i.id === id ? { ...i, nome: novoNome.trim() } : i))))
    router.refresh()
  }

  async function handleDelete(id: string) {
    const ok = confirm('Tem certeza que deseja excluir?')
    if (!ok) return

    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) return alert(error.message)

    setItems(items.filter((i) => i.id !== id))
    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl">
        <b>{title}</b>
      </h1>

      <div className="flex gap-2">
        <input
          className="border p-2 rounded w-full"
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleCreate}>
          Criar
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="border rounded p-3 flex items-center justify-between">
            <span>{i.nome}</span>
            <div className="flex gap-2">
              <button className="border px-3 py-1 rounded" onClick={() => handleEdit(i.id)}>
                Editar
              </button>
              <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => handleDelete(i.id)}>
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && <p className="text-sm text-gray-600">Nenhum item cadastrado.</p>}
    </div>
  )
}