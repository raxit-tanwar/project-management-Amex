'use client'

import { isProjectOverdue, isTaskOverdue } from '@/lib/utils'
import { User, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ProjectCardProps {
    project: {
        id: string
        name: string
        event_code?: string
        client?: { name: string }
        client_color?: string
        // stakeholder info
        stakeholder_name?: string
        stakeholder_email?: string
        // build info
        build_type?: string
        // dates
        due_date?: string
        // stage
        stage?: { name: string; color: string }
        // relations
        tasks?: { id: string; status: string; due_at?: string | null; due_has_time?: boolean }[]
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
    const tasksInProgress = tasks.filter(t => t.status === 'In Progress').length
    const overdueTasks = tasks.filter(t => t.status !== 'Done' && isTaskOverdue(t.due_at, t.due_has_time)).length
    const overdue = isProjectOverdue(project.due_date, project.stage?.name)
    const stageColor = project.stage?.color ?? '#4f46e5'

    const checklistPercent = checklist.length > 0 ? (checklistDone / checklist.length) * 100 : 0
    const allChecklistDone = checklist.length > 0 && checklistDone === checklist.length

    return (
        <div
            onClick={onClick}
            style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                position: 'relative',
                borderLeft: `3px solid ${stageColor}`,
                boxShadow: 'var(--shadow-xs)',
            }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.boxShadow = 'var(--shadow-md)'
                el.style.borderColor = 'var(--border2)'
                el.style.borderLeftColor = stageColor
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.boxShadow = 'var(--shadow-xs)'
                el.style.borderColor = 'var(--border)'
                el.style.borderLeftColor = stageColor
            }}
        >
            {/* Overdue-task indicator — red dot in the top-right corner for quick scanning */}
            {overdueTasks > 0 && (
                <span
                    title={`${overdueTasks} overdue task${overdueTasks !== 1 ? 's' : ''}`}
                    style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 9, height: 9, borderRadius: '50%', background: '#dc2626',
                        boxShadow: '0 0 0 3px rgba(220,38,38,0.18)',
                    }}
                />
            )}

            {/* Event code chip */}
            {project.event_code && (
                <div style={{ marginBottom: 8 }}>
                    <span style={{
                        display: 'inline-block',
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: stageColor,
                        background: `${stageColor}14`,
                        border: `1px solid ${stageColor}30`,
                        padding: '2px 8px',
                        borderRadius: 5,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase'
                    }}>
                        {project.event_code}
                    </span>
                </div>
            )}

            {/* Project name */}
            <div style={{
                fontSize: 14, fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.3,
                marginBottom: 8,
                letterSpacing: '-0.01em'
            }}>
                {project.name}
            </div>

            {/* Client + Stakeholder row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {project.client?.name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: project.client_color ?? '#4f46e5'
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {project.client.name}
                        </span>
                    </div>
                )}
                {project.stakeholder_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} color="var(--text-dim)" />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {project.stakeholder_name}
                        </span>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }} />

            {/* Footer row: tasks + checklist + time + due */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

                {/* Tasks pill */}
                {tasks.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 6,
                        background: tasksDone === tasks.length ? 'rgba(22,163,74,0.08)' : 'var(--surface2)',
                        border: `1px solid ${tasksDone === tasks.length ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`,
                    }}>
                        <CheckCircle2 size={11} color={tasksDone === tasks.length ? 'var(--success)' : 'var(--text-dim)'} />
                        <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: tasksDone === tasks.length ? 'var(--success)' : 'var(--text-muted)'
                        }}>
                            {tasksDone}/{tasks.length}
                        </span>
                        {tasksInProgress > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>· {tasksInProgress} active</span>
                        )}
                    </div>
                )}

                {/* Overdue tasks badge */}
                {overdueTasks > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 6,
                        background: 'rgba(220,38,38,0.08)',
                        border: '1px solid rgba(220,38,38,0.25)',
                    }}>
                        <AlertTriangle size={11} color="var(--danger)" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>
                            {overdueTasks} overdue
                        </span>
                    </div>
                )}

                {/* Checklist progress bar pill */}
                {checklist.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 6,
                        background: allChecklistDone ? 'rgba(22,163,74,0.08)' : 'var(--surface2)',
                        border: `1px solid ${allChecklistDone ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`,
                        minWidth: 70
                    }}>
                        {/* Mini progress bar */}
                        <div style={{ width: 30, height: 4, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                            <div style={{ width: `${checklistPercent}%`, height: '100%', borderRadius: 2, background: allChecklistDone ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: allChecklistDone ? 'var(--success)' : 'var(--text-muted)' }}>
                            {checklistDone}/{checklist.length}
                        </span>
                    </div>
                )}

                {/* Time tracked */}
                {totalSeconds > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
                        <Clock size={11} /> {formatHours(totalSeconds)}
                    </span>
                )}

                {/* Due date */}
                {project.due_date && (
                    <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: overdue ? 'var(--danger)' : 'var(--text-dim)',
                        background: overdue ? 'rgba(220,38,38,0.06)' : 'transparent',
                        padding: overdue ? '1px 5px' : '0',
                        borderRadius: 4,
                        marginLeft: totalSeconds > 0 ? 0 : 'auto'
                    }}>
                        {new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>
        </div>
    )
}
