// Shared loading skeleton shown instantly while any dashboard page fetches data
export default function DashboardLoading() {
    return (
        <div style={{ padding: '20px 28px', height: '100%' }}>
            {/* Greeting skeleton */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ width: 260, height: 22, borderRadius: 8, background: 'var(--border)', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 180, height: 14, borderRadius: 6, background: 'var(--border2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            {/* Timer bar skeleton */}
            <div style={{ height: 56, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20, animation: 'pulse 1.5s ease-in-out infinite' }} />
            {/* Tab bar */}
            <div style={{ height: 44, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20, animation: 'pulse 1.5s ease-in-out infinite' }} />
            {/* Content rows */}
            {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 52, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 10, animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </div>
    )
}
