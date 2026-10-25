import { createContext, useContext } from 'react'
import type { AdminService, DateRange } from './domain'

export interface AdminContextValue {
  api: AdminService
  toast: (text: string, error?: boolean) => void
  navigate: (path: string) => void
  range: DateRange
  setRange: (range: DateRange) => void
}
export const AdminContext = createContext<AdminContextValue | null>(null)
export const useAdmin = () => {
  const context = useContext(AdminContext)
  if (!context) throw new Error('Admin workspace is missing its provider.')
  return context
}
