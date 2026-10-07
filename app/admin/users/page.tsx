'use client'

import { Search, UserCheck, UserX, MoreHorizontal } from 'lucide-react'

const USERS = [
  { id: 'st123456', name: 'Alex W.', program: 'Computer Science', batch: "Fall '24", status: 'Active', verified: true },
  { id: 'st123457', name: 'Priya S.', program: 'Data Science', batch: "Spring '24", status: 'Active', verified: true },
  { id: 'AIT-2026-X', name: 'Incoming Student', program: 'Civil Eng', batch: "Fall '26", status: 'Pending', verified: false },
  { id: 'st100000', name: 'John D.', program: 'Management', batch: "Fall '23", status: 'Suspended', verified: true },
]

export default function AdminUsersPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Admin Portal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">User Management</h1>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search users..." 
            className="h-10 w-full border border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4 border-b border-border">ID / Email</th>
                <th className="px-6 py-4 border-b border-border">Name</th>
                <th className="px-6 py-4 border-b border-border">Program</th>
                <th className="px-6 py-4 border-b border-border">Verification</th>
                <th className="px-6 py-4 border-b border-border">Status</th>
                <th className="px-6 py-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {USERS.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-6 py-4 font-medium">{u.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-semibold">{u.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">{u.program} &middot; {u.batch}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {u.verified ? (
                      <span className="inline-flex items-center gap-1.5 text-primary text-[11px] font-semibold uppercase tracking-wider">
                        <UserCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 text-[11px] font-semibold uppercase tracking-wider">
                        <UserX className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      u.status === 'Active' ? 'bg-primary-muted text-primary' : 
                      u.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
