'use client'

import { getPriorityColor, isOverdue, formatDuration } from '@/lib/utils'

interface ProjectCardProps {
    project: {
        id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string; priority: string
        due_date?: string; stage?: { name: string; color: string }
        tasks?: { id: string; status: string }[]
        checklist_items?: { id: string; checked: boolean }[]
        time_entries?: { duration_seconds: number }[]
    }
    totalSeconds: number
    formatHours: (s: number) => string
    onClick: () => void
    onRefresh: () => void
}

export default function ProjectCard({ project, totalSeconds, formatHours, onClick }: ProjectCardProps) {
    const checklist = project.checklist_items ?? []
    const checklistDone = checklist.filter(c => c.checked).length
    const tasks = project.tasks ?? []
    const tasksDone = tasks.filter(t => t.status === 'Done').length
    const overdue = isOverdue(project.due_date)
    const priorityColor = getPriorityColor(project.priority)

    const checklistPercent = checklist.length > 0 ? checklistDone / checklist.length : 0
    const circumference = 2 * Math.PI * 10
    const dashOffset = circumference * (1 - checklistPercent)

    return (
        <div
            className="card"
            onClick={onClick}
            style={{
                padding: '14px', cursor: 'pointer',
                borderLeft: `3px solid ${priorityColor}`,
                transition: 'all 0.2s ease',
                position: 'relative', overflow: 'hidden'
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                    ; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    ; (e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, marginBottom: 2 }}>
                        {project.event_code && <span style={{ color: 'var(--accent-light)', marginRight: 6 }}>{project.event_code}</span>}
                        {project.name}
                    </div>
                    {project.client?.name && (
                        <span style={{
                            display: 'inline-block', fontSize: 10, fontWeight: 700,
                            padding: '1px 6px', borderRadius: 4,
                            background: `${project.client_color ?? '#6366f1'}15`,
                            color: project.client_color ?? '#6366f1',
                            letterSpacing: '0.02em', marginTop: 2
                        }}>{project.client.name}</span>
                    )}
                </div>

                {/* Checklist progress ring */}
                {checklist.length > 0 && (
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
                        <circle cx="14" cy="14" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                        <circle
                            cx="14" cy="14" r="10" fill="none"
                            stroke={checklistDone === checklist.length ? 'var(--success)' : 'var(--accent)'}
                            strokeWidth="2.5"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className="ring-progress"
                        />
                        <text x="14" y="18" textAnchor="middle" style={{ fontSize: '7px', fontWeight: 700, fill: 'var(--text-muted)' }}>
                            {checklistDone}/{checklist.length}
                        </text>
                    </svg>
                )}
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge priority-${project.priority}`} style={{ fontSize: 10 }}>
                    {project.priority}
                </span>

                {tasks.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>
                        ✓ {tasksDone}/{tasks.length}
                    </span>
                )}

                {totalSeconds > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, fontFamily: 'monospace' }}>
                        ⏱ {formatHours(totalSeconds)}
                    </span>
                )}

                {project.due_date && (
                    <span style={{
                        fontSize: 10, fontWeight: 600, marginLeft: 'auto',
                        color: overdue ? 'var(--danger)' : 'var(--text-dim)'
                    }}>
                        {overdue ? '⚠ ' : '📅 '}
                        {new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>
        </div>
    )
}
