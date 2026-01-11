import { redirect } from 'next/navigation'
import { getMyRole } from '@/lib/auth/getMyRole'
import { createClient } from '@/lib/supabase/server'
import { AdminLookupCrud } from './ui'

export default async function RolesFunctionsAdminPage() {
  const role = await getMyRole()
  if (role !== 'admin') redirect('/app')

  const supabase = await createClient()
  const { data: items, error } = await supabase
    .from('roles_functions')
    .select('id,nome')
    .order('nome', { ascending: true })

  if (error) throw error

  return <AdminLookupCrud title="Funções/Cargos" tableName="roles_functions" items={items ?? []} />
}