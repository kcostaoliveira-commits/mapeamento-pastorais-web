'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NewAgentForm() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [contato, setContato] = useState('')
  const router = useRouter()

  return (
    <form className="max-w-lg space-y-3" onSubmit={async (e) => {
      e.preventDefault()
      const { error } = await createClient().from('agents').insert({ nome, email, contato })
      if (error) return alert(error.message)
      router.push('/app/agents')
      router.refresh()
    }}>
      <h1 className="text-2xl"><b>Novo agente</b></h1>
      <input className="border p-2 w-full" placeholder="Nome" value={nome} onChange={e=>setNome(e.target.value)} />
      <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 w-full" placeholder="Contato" value={contato} onChange={e=>setContato(e.target.value)} />
      <button className="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
    </form>
  )
}