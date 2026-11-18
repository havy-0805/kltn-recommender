import type { ReactNode } from 'react'
import { Card } from '../../components/ui'

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-[480px] p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-10" />
          <span className="text-xl font-bold text-slate-900">Trung tâm Tri Thức</span>
        </div>
        <h1 className="text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        {children}
      </Card>
    </div>
  )
}
