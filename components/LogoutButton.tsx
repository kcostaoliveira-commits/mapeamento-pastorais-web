'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      className="border px-3 py-1 rounded"
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/login')
      }}
    >
      Sair
    </button>
  )
}