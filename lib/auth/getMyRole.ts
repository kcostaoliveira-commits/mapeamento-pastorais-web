import { createClient } from '@/lib/supabase/server'

export async function getMyRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data.role as 'admin' | 'cadastrador' | 'consulta'
}