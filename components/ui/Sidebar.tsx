'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Kanban, BarChart2, Settings, LogOut, Layers } from 'lucide-react'
import { useState } from 'react'
import { useTimer } from '@/context/TimerContext'

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
            width: 232, flexShrink: 0,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '20px 12px 16px',
            position: 'relative', zIndex: 10
        }}>
            {/* Logo */}
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 8px' }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Layers size={15} color="white" strokeWidth={2.2} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                    FlowDesk
                </span>
            </Link>

            {/* Nav */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px', marginBottom: 6 }}>
                    Workspace
                </div>
                {navItems.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 'var(--radius)',
                                textDecoration: 'none',
                                fontSize: 13.5, fontWeight: active ? 600 : 500,
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                                background: active ? 'var(--accent-dim)' : 'transparent',
                                transition: 'background 0.15s ease, color 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                            }}
                            onMouseLeave={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                            }}
                        >
                            <Icon size={16} strokeWidth={active ? 2.2 : 2} />
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
                        padding: '10px 12px', borderRadius: 'var(--radius)',
                        background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.25)',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                        fontFamily: 'inherit'
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(22,163,74,0.11)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(22,163,74,0.06)'}
                    title="Click to open project"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} className="animate-pulse-glow" />
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tracking</span>
                        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--success)' }}>
                            {displayTime}
                        </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {timer.projectName || 'Unknown project'}
                    </div>
                    {timer.taskName && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {timer.taskName}
                        </div>
                    )}
                </button>
            )}

            {/* User section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{
                    padding: '8px 8px',
                    display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'var(--accent-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', flexShrink: 0
                    }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.email}
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="btn-icon"
                        title="Sign out"
                        aria-label="Sign out"
                        style={{ flexShrink: 0 }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
