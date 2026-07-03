import Link from 'next/link'
import { Layers, Kanban, Clock, ListChecks, BarChart2 } from 'lucide-react'

const FEATURES = [
    { icon: Kanban, text: 'Visual Kanban board with drag & drop' },
    { icon: Clock, text: 'Built-in time tracking on every project' },
    { icon: ListChecks, text: 'Per-project quality checklists' },
    { icon: BarChart2, text: 'Reports with charts & CSV export' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>
            {/* Left panel — branding */}
            <div style={{
                flex: '0 0 420px', display: 'flex', flexDirection: 'column',
                padding: '40px', borderRight: '1px solid var(--border)',
                background: 'var(--surface)', position: 'relative',
                overflow: 'hidden'
            }}>
                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Layers size={18} color="white" strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                        FlowDesk
                    </span>
                </Link>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.25, color: 'var(--text)' }}>
                        One workspace for<br />everything you ship.
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 44 }}>
                        Kanban boards, time tracking, quality checklists, and reports — unified in one professional workspace.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {FEATURES.map(item => {
                            const Icon = item.icon
                            return (
                                <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                        background: 'var(--accent-dim)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Icon size={16} color="var(--accent)" strokeWidth={2} />
                                    </div>
                                    <span style={{ fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 500 }}>{item.text}</span>
                                </div>
                            )
                        })}
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
