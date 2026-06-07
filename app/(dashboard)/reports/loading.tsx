export default function ReportsLoading() {
    return (
        <div style={{ padding: '28px', height: '100%' }}>
            <div style={{ width: 140, height: 24, borderRadius: 8, background: 'var(--border)', marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 200, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
                ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </div>
    )
}
