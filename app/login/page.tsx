'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const router = useRouter()
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) setError(error.message); else router.push('/app')
  }
  return (<form onSubmit={onSubmit} className="p-6 max-w-sm mx-auto">
    <h1 className="text-2xl mb-4">Login</h1>
    {error && <p className="text-red-600 mb-2">{error}</p>}
    <input className="border p-2 w-full mb-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/>
    <input className="border p-2 w-full mb-4" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" type="password"/>
    <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Entrar</button>
  </form>)
}