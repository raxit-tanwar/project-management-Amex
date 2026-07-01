'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Kanban, BarChart2, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTimer } from '@/context/TimerContext'
import { formatDuration } from '@/lib/utils'

interface SidebarProps {
    user: { email: string; name: string }
}

const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/board', label: 'Board', icon: Kanban },
    { href: '/reports', label: 'Reports', icon: BarChart2 },
    { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [signingOut, setSigningOut] = useState(false)
    const { timer, displayTime, setPendingOpen } = useTimer()

    async function handleSignOut() {
        setSigningOut(true)
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <aside style={{
            width: 220, flexShrink: 0,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '20px 12px',
            position: 'relative', zIndex: 10,
            boxShadow: '1px 0 4px rgba(0,0,0,0.04)'
        }}>
            {/* Logo */}
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, padding: '0 8px' }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                }}>
                    <Home size={15} color="white" />
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                    Flow<span style={{ color: '#6366f1' }}>Desk</span>
                </span>
            </Link>

            {/* Nav */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {navItems.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 12px', borderRadius: 10,
                                textDecoration: 'none',
                                fontSize: 14, fontWeight: active ? 600 : 500,
                                color: active ? '#6366f1' : 'var(--text-muted)',
                                background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                                border: active ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                            }}
                            onMouseLeave={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                            }}
                        >
                            <Icon size={16} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Global timer indicator */}
            {timer.isRunning && timer.projectId && (
                <button
                    onClick={() => {
                        setPendingOpen({ projectId: timer.projectId!, tab: 'timelog' })
                        router.push('/board')
                    }}
                    style={{
                        width: '100%', marginBottom: 12,
                        padding: '10px 12px', borderRadius: 10,
                        background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(22,163,74,0.14)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(22,163,74,0.08)'}
                    title="Click to open project"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 2px rgba(22,163,74,0.3)', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recording</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {timer.projectName || 'Unknown project'}
                    </div>
                    {timer.taskName && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                            {timer.taskName}
                        </div>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: '#16a34a', letterSpacing: '0.04em' }}>
                        {displayTime}
                    </div>
                </button>
            )}

            {/* User section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{
                    padding: '10px 12px', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 8, background: 'var(--surface2)'
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0
                    }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.email}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
            </div>
        </aside>
    )
}
