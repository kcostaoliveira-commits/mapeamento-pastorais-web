import { redirect } from 'next/navigation'
import { getMyRole } from '@/lib/auth/getMyRole'
import { canEdit } from '@/lib/auth/can'
import { NewAgentForm } from './ui'

export default async function NewAgentPage() {
  const role = await getMyRole()
  if (!canEdit(role)) redirect('/app/agents')
  return <NewAgentForm />
}