export function canEdit(role: string | null) {
  return role === 'admin' || role === 'cadastrador'
}
export function isAdmin(role: string | null) {
  return role === 'admin'
}