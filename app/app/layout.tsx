import Link from 'next/link'
import { LogoutButton } from '@/components/LogoutButton'
import { getMyRole } from '@/lib/auth/getMyRole'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getMyRole()

  return (
    <div>
      <header className="p-4 border-b flex items-center justify-between">
        <nav className="flex gap-4 flex-wrap">
          <Link href="/app">Início</Link>
          <Link href="/app/agents">Agentes</Link>

          {role === 'admin' && (
            <>
              <span className="text-gray-400">|</span>
              <Link href="/app/admin/parishes">Admin: Paróquias</Link>
              <Link href="/app/admin/pastoral-groups">Admin: Pastorais/Grupos</Link>
              <Link href="/app/admin/roles-functions">Admin: Funções/Cargos</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm">
            Papel: <b>{role}</b>
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="p-6">{children}</main>
    </div>
  )
}
