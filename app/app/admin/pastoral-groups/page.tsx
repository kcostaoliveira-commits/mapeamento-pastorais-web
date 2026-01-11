import { redirect } from 'next/navigation'
import { getMyRole } from '@/lib/auth/getMyRole'
import { createClient } from '@/lib/supabase/server'
import { AdminLookupCrud } from './ui'

export default async function PastoralGroupsAdminPage() {
  const role = await getMyRole()
  if (role !== 'admin') redirect('/app')

  const supabase = await createClient()
  const { data: items, error } = await supabase
    .from('pastoral_groups')
    .select('id,nome')
    .order('nome', { ascending: true })

  if (error) throw error

  return <AdminLookupCrud title="Pastorais/Grupos" tableName="pastoral_groups" items={items ?? []} />
}