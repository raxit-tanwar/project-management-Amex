import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <div className="gradient-mesh" />

            {/* Left panel — branding */}
            <div style={{
                flex: '0 0 420px', display: 'flex', flexDirection: 'column',
                padding: '40px', borderRight: '1px solid var(--border)',
                background: 'var(--surface)', position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 80% 60% at 10% 30%, rgba(99,102,241,0.1) 0%, transparent 60%)'
                }} />

                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 11,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, boxShadow: '0 4px 16px rgba(99,102,241,0.4)'
                    }}>⚡</div>
                    <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                        Flow<span style={{ color: 'var(--accent-light)' }}>Desk</span>
                    </span>
                </Link>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
                        One desk for<br />everything you ship.
                    </h2>
                    <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 48 }}>
                        Kanban boards, time tracking, quality checklists, and reports — unified in one premium workspace.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {[
                            { icon: '⚡', text: 'Visual Kanban board with drag & drop' },
                            { icon: '⏱', text: 'Built-in floating timer widget' },
                            { icon: '✅', text: 'Per-project quality checklists' },
                            { icon: '📊', text: 'Reports with charts & CSV export' },
                        ].map(item => (
                            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                    background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                                }}>{item.icon}</div>
                                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    © {new Date().getFullYear()} FlowDesk
                </p>
            </div>

            {/* Right panel — auth form */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px', position: 'relative', zIndex: 1
            }}>
                {children}
            </div>
        </div>
    )
}
