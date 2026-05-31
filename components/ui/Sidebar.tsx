'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signout } from '@/app/(auth)/actions'

interface SidebarProps {
    user: { email: string; name: string }
}

const navItems = [
    { href: '/dashboard', label: 'Board', icon: '⚡' },
    { href: '/reports', label: 'Reports', icon: '📊' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname()

    return (
        <aside style={{
            width: 220, flexShrink: 0,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '24px 12px',
            position: 'relative', zIndex: 10
        }}>
            {/* Logo */}
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, padding: '0 8px' }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
                }}>⚡</div>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                    Flow<span style={{ color: 'var(--accent-light)' }}>Desk</span>
                </span>
            </Link>

            {/* Nav */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {navItems.map(item => {
                    const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 12px', borderRadius: 10,
                                textDecoration: 'none',
                                fontSize: 14, fontWeight: active ? 700 : 500,
                                color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                                background: active ? 'var(--accent-dim)' : 'transparent',
                                border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                            }}
                            onMouseLeave={e => {
                                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

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
                <form action={signout}>
                    <button type="submit" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                        Sign out
                    </button>
                </form>
            </div>
        </aside>
    )
}
