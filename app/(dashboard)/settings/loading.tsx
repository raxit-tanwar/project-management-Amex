export default function SettingsLoading() {
    return (
        <div style={{ padding: '28px', maxWidth: 680 }}>
            <div style={{ width: 120, height: 24, borderRadius: 8, background: 'var(--border)', marginBottom: 28, animation: 'pulse 1.5s ease-in-out infinite' }} />
            {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14, animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </div>
    )
}
