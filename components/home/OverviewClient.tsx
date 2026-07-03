'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    format, isSameDay, isSameMonth, addMonths, subMonths, isToday,
} from 'date-fns'
import { FolderKanban, ListTodo, CalendarClock, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { isOverdue, daysRemaining, isTaskOverdue } from '@/lib/utils'

interface Stage { id: string; name: string; color: string; position: number }
interface Task { id: string; status: string; name: string; due_at?: string | null; due_has_time?: boolean }

function formatTaskDue(due_at?: string | null, hasTime?: boolean): string {
    if (!due_at) return ''
    const d = new Date(due_at)
    const datePart = d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    if (!hasTime) return datePart
    return `${datePart} · ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
}
interface Project {
    id: string; name: string; event_code?: string; due_date?: string | null
    stage_id?: string; stage?: Stage | null; client?: { name: string } | null
    tasks?: Task[]
}

interface OverviewClientProps {
    userDisplayName?: string
    initialStages: Stage[]
    initialProjects: Project[]
}

const CARD: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20,
}

export default function OverviewClient({ userDisplayName, initialStages, initialProjects }: OverviewClientProps) {
    const stages = useMemo(() => [...initialStages].sort((a, b) => a.position - b.position), [initialStages])
    const projects = initialProjects
    const [calendarMonth, setCalendarMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState<string | null>(null)

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

    const stageGroups = useMemo(() =>
        stages.map(s => ({ ...s, count: projects.filter(p => p.stage_id === s.id).length }))
            .filter(s => s.count > 0 || stages.length <= 6)
    , [stages, projects])

    const totalActive = projects.length

    const allTasks = useMemo(() =>
        projects.flatMap(p => (p.tasks ?? []).map(t => ({
            ...t, projectId: p.id, projectName: p.name, projectDue: p.due_date, eventCode: p.event_code,
        })))
    , [projects])

    const pendingTasks = allTasks.filter(t => t.status !== 'Done')
    const todoCount = allTasks.filter(t => t.status === 'To Do').length
    const inProgressCount = allTasks.filter(t => t.status === 'In Progress').length
    const projectsWithPending = new Set(pendingTasks.map(t => t.projectId)).size

    // Task-level due tracking (uses each task's own due_at, not the parent project's due date)
    const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t.due_at, t.due_has_time))
    const tasksDueThisWeek = pendingTasks.filter(t => {
        const d = daysRemaining(t.due_at)
        return d !== null && d >= 0 && d <= 7
    })

    const overdueProjects = projects.filter(p => isOverdue(p.due_date))
    const dueThisWeek = projects.filter(p => {
        const d = daysRemaining(p.due_date)
        return d !== null && d >= 0 && d <= 7
    })

    // Pending tasks that carry their own due date — overdue first, then soonest.
    const upcomingTasks = useMemo(() =>
        pendingTasks
            .filter(t => t.due_at)
            .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
            .slice(0, 6)
    , [pendingTasks])

    // Map of yyyy-MM-dd -> projects due that day (for calendar dots)
    const dueByDate = useMemo(() => {
        const map = new Map<string, Project[]>()
        projects.forEach(p => {
            if (!p.due_date) return
            const key = p.due_date.slice(0, 10)
            const arr = map.get(key) ?? []
            arr.push(p)
            map.set(key, arr)
        })
        return map
    }, [projects])

    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

    const upcomingProjects = useMemo(() => {
        const source = selectedDay
            ? projects.filter(p => p.due_date?.slice(0, 10) === selectedDay)
            : projects.filter(p => p.due_date)
        return source.slice(0, 4)
    }, [projects, selectedDay])

    const cardAccent = (p: Project) => p.stage?.color ?? '#6366f1'

    return (
        <div style={{ padding: '20px 28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
                    Good {greeting}, {userDisplayName || 'there'} 👋
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* Project stages */}
                <div style={{ ...CARD, flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <FolderKanban size={16} color="var(--accent-light)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Project Stages</span>
                        <Link href="/board" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                            View board
                        </Link>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
                        {totalActive} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>active projects</span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', marginBottom: 10 }}>
                        {stageGroups.filter(s => s.count > 0).map(s => (
                            <div key={s.id} style={{ width: `${(s.count / (totalActive || 1)) * 100}%`, background: s.color }} title={`${s.name}: ${s.count}`} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {stageGroups.map(s => (
                            <span key={s.id} style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                background: `${s.color}18`, color: s.color,
                            }}>{s.name} · {s.count}</span>
                        ))}
                    </div>
                </div>

                {/* Pending tasks */}
                <div style={{ ...CARD, flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <ListTodo size={16} color="var(--accent-light)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Pending Tasks</span>
                        <Link href="/board" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                            View tasks
                        </Link>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
                        {pendingTasks.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>across {projectsWithPending} project{projectsWithPending !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${allTasks.length ? (pendingTasks.length / allTasks.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text-muted)' }}>To Do · {todoCount}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)' }}>In Progress · {inProgressCount}</span>
                        {overdueTasks.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.12)', color: 'var(--danger)' }}>Overdue · {overdueTasks.length}</span>
                        )}
                    </div>
                </div>

                {/* Due dates */}
                <div style={{ ...CARD, flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <AlertCircle size={16} color="var(--danger)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Due Dates</span>
                        <Link href="/reports" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                            View reports
                        </Link>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: overdueProjects.length > 0 ? 'var(--danger)' : 'var(--text)', marginBottom: 10 }}>
                        {overdueProjects.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>overdue project{overdueProjects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${totalActive ? (overdueProjects.length / totalActive) * 100 : 0}%`, background: 'var(--danger)', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(217,119,6,0.1)', color: 'var(--warning)' }}>
                        Due this week · {dueThisWeek.length}
                    </span>
                </div>
            </div>

            {/* Quick stat chips */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                    { label: 'Pending Tasks', count: pendingTasks.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                    { label: 'Overdue Tasks', count: overdueTasks.length, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                    { label: 'Tasks Due This Week', count: tasksDueThisWeek.length, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                    { label: 'Overdue Projects', count: overdueProjects.length, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                    { label: 'Active Projects', count: totalActive, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                ].map(chip => (
                    <Link key={chip.label} href="/board" style={{
                        ...CARD, padding: '14px 18px', flex: '1 1 200px', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 10, background: chip.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 800, color: chip.color, flexShrink: 0,
                        }}>{chip.count}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{chip.label}</span>
                        <ChevronRight size={16} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />
                    </Link>
                ))}
            </div>

            {/* Action items — pending tasks that have their own due date */}
            {upcomingTasks.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Action Items</h2>
                        {overdueTasks.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(220,38,38,0.12)', color: 'var(--danger)' }}>
                                {overdueTasks.length} overdue
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                        {upcomingTasks.map(t => {
                            const overdue = isTaskOverdue(t.due_at, t.due_has_time)
                            return (
                                <Link key={t.id} href={`/board?project=${t.projectId}`} style={{
                                    ...CARD, padding: 16, textDecoration: 'none', display: 'block',
                                    borderColor: overdue ? 'rgba(220,38,38,0.4)' : 'var(--border)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>{t.eventCode || t.projectName}</span>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            background: t.status === 'In Progress' ? 'rgba(99,102,241,0.12)' : 'var(--surface2)',
                                            color: t.status === 'In Progress' ? 'var(--accent-light)' : 'var(--text-muted)',
                                        }}>{t.status}</span>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t.name}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        📅 {formatTaskDue(t.due_at, t.due_has_time)}{overdue ? ' · overdue' : ''}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Schedule: calendar + upcoming due dates */}
            <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Schedule</h2>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Calendar */}
                    <div style={{ ...CARD, flex: '0 0 320px', minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                            <button onClick={() => setCalendarMonth(m => subMonths(m, 1))} className="btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                                <ChevronLeft size={16} />
                            </button>
                            <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                {format(calendarMonth, 'MMMM yyyy')}
                            </span>
                            <button onClick={() => setCalendarMonth(m => addMonths(m, 1))} className="btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', padding: '2px 0' }}>{d}</div>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                            {calendarDays.map(day => {
                                const key = format(day, 'yyyy-MM-dd')
                                const due = dueByDate.get(key)
                                const inMonth = isSameMonth(day, calendarMonth)
                                const today = isToday(day)
                                const selected = selectedDay === key
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedDay(prev => prev === key ? null : (due ? key : null))}
                                        style={{
                                            aspectRatio: '1', border: 'none', borderRadius: 8, cursor: due ? 'pointer' : 'default',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                            background: selected ? 'var(--accent)' : today ? 'var(--accent-dim)' : 'transparent',
                                            color: selected ? 'white' : !inMonth ? 'var(--text-dim)' : 'var(--text)',
                                            fontWeight: today || selected ? 700 : 500, fontSize: 12,
                                        }}
                                    >
                                        {format(day, 'd')}
                                        {due && (
                                            <div style={{ display: 'flex', gap: 1 }}>
                                                {due.slice(0, 3).map((p, i) => (
                                                    <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: selected ? 'white' : cardAccent(p) }} />
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        {selectedDay && (
                            <button onClick={() => setSelectedDay(null)} style={{
                                marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--accent-light)',
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            }}>
                                ← Show all upcoming
                            </button>
                        )}
                    </div>

                    {/* Upcoming due date cards */}
                    <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                        {upcomingProjects.length === 0 && (
                            <div style={{ ...CARD, gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                                <CalendarClock size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <p style={{ fontSize: 13 }}>{selectedDay ? 'No projects due on this date.' : 'No upcoming due dates.'}</p>
                            </div>
                        )}
                        {upcomingProjects.map(p => {
                            const d = daysRemaining(p.due_date)
                            const overdue = isOverdue(p.due_date)
                            const accent = cardAccent(p)
                            const pending = (p.tasks ?? []).filter(t => t.status !== 'Done').length
                            return (
                                <Link key={p.id} href={`/board?project=${p.id}`} style={{ ...CARD, textDecoration: 'none', display: 'block' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        {p.event_code && (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>{p.event_code}</span>
                                        )}
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            background: `${accent}18`, color: accent,
                                        }}>{p.stage?.name ?? 'No stage'}</span>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                                        {pending} pending task{pending !== 1 ? 's' : ''}{p.client?.name ? ` · ${p.client.name}` : ''}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {p.due_date ? new Date(p.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: overdue ? 'var(--danger)' : 'var(--text-dim)' }}>
                                            {overdue ? `${Math.abs(d ?? 0)}d overdue` : d === 0 ? 'Due today' : `${d}d remaining`}
                                        </span>
                                    </div>
                                    <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 3,
                                            width: overdue ? '100%' : `${Math.max(6, 100 - Math.min(100, ((d ?? 0) / 30) * 100))}%`,
                                            background: overdue ? 'var(--danger)' : accent,
                                        }} />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
