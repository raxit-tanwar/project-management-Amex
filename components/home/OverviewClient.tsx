'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    format, isSameMonth, addMonths, subMonths, isToday,
} from 'date-fns'
import { FolderKanban, ListTodo, Clock, CalendarClock, ChevronRight, ChevronLeft, CalendarDays, X } from 'lucide-react'
import { daysRemaining, isTaskOverdue } from '@/lib/utils'

interface Stage { id: string; name: string; color: string; position: number }
interface Task { id: string; status: string; name: string; due_at?: string | null; due_has_time?: boolean }
interface Project {
    id: string; name: string; event_code?: string; due_date?: string | null
    stage_id?: string; stage?: Stage | null; client?: { name: string } | null
    tasks?: Task[]
}
interface TimeEntry { started_at: string; duration_seconds?: number | null }

interface OverviewClientProps {
    userDisplayName?: string
    initialStages: Stage[]
    initialProjects: Project[]
    timeEntries: TimeEntry[]
}

const CARD: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
    boxShadow: 'var(--shadow-xs)',
}

// Daily work allotment used for efficiency figures (user works ~8h/day).
const ALLOTTED_DAILY_SECONDS = 8 * 3600
const WORK_DAYS_PER_WEEK = 5

function formatHm(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatTaskDue(due_at?: string | null, hasTime?: boolean): string {
    if (!due_at) return ''
    const d = new Date(due_at)
    const datePart = d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    if (!hasTime) return datePart
    return `${datePart} · ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
}

export default function OverviewClient({ userDisplayName, initialStages, initialProjects, timeEntries }: OverviewClientProps) {
    const stages = useMemo(() => [...initialStages].sort((a, b) => a.position - b.position), [initialStages])
    const projects = initialProjects
    const [calendarMonth, setCalendarMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [showTasksModal, setShowTasksModal] = useState(false)

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

    const stageGroups = useMemo(() =>
        stages.map(s => ({ ...s, count: projects.filter(p => p.stage_id === s.id).length }))
            .filter(s => s.count > 0 || stages.length <= 6)
    , [stages, projects])

    const totalActive = projects.length

    const allTasks = useMemo(() =>
        projects.flatMap(p => (p.tasks ?? []).map(t => ({
            ...t, projectId: p.id, projectName: p.name, eventCode: p.event_code,
        })))
    , [projects])
    type FlatTask = typeof allTasks[number]

    const pendingTasks = allTasks.filter(t => t.status !== 'Done')
    const todoCount = allTasks.filter(t => t.status === 'To Do').length
    const inProgressCount = allTasks.filter(t => t.status === 'In Progress').length
    const projectsWithPending = new Set(pendingTasks.map(t => t.projectId)).size

    // Task-level due tracking (each task's own due_at, not the parent project's due date)
    const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t.due_at, t.due_has_time))
    const tasksDueThisWeek = pendingTasks.filter(t => {
        const d = daysRemaining(t.due_at)
        return d !== null && d >= 0 && d <= 7
    })

    // Pending tasks that carry a due date — overdue first (past dates sort first), then soonest.
    const datedPendingTasks = useMemo(() =>
        pendingTasks
            .filter(t => t.due_at)
            .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    , [pendingTasks])

    // Pending tasks grouped under their project code, for the "View tasks" modal.
    // Within each group, tasks are ordered by urgency: overdue first (most overdue
    // leading), then soonest due, then undated; In Progress edges out To Do on ties.
    // Groups themselves are ordered by their single most urgent task.
    const pendingByProject = useMemo(() => {
        const urgencyOf = (t: FlatTask) => (t.due_at ? new Date(t.due_at).getTime() : Infinity)
        const statusRank = (t: FlatTask) => (t.status === 'In Progress' ? 0 : 1)
        const groups = new Map<string, { projectId: string; code: string; projectName: string; tasks: FlatTask[]; urgency: number }>()
        allTasks.forEach(t => {
            if (t.status === 'Done') return
            let g = groups.get(t.projectId)
            if (!g) {
                g = { projectId: t.projectId, code: t.eventCode || t.projectName || 'Untitled', projectName: t.projectName || '', tasks: [], urgency: Infinity }
                groups.set(t.projectId, g)
            }
            g.tasks.push(t)
        })
        const list = Array.from(groups.values())
        list.forEach(g => {
            g.tasks.sort((a, b) => urgencyOf(a) - urgencyOf(b) || statusRank(a) - statusRank(b) || a.name.localeCompare(b.name))
            g.urgency = g.tasks.length ? urgencyOf(g.tasks[0]) : Infinity
        })
        list.sort((a, b) => a.urgency - b.urgency || a.code.localeCompare(b.code))
        return list
    }, [allTasks])

    // Close the tasks modal on Escape.
    useEffect(() => {
        if (!showTasksModal) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTasksModal(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [showTasksModal])

    // Map of yyyy-MM-dd (local) -> dated pending tasks, for calendar dots + day filter.
    const taskDueByDate = useMemo(() => {
        const map = new Map<string, FlatTask[]>()
        datedPendingTasks.forEach(t => {
            const key = format(new Date(t.due_at!), 'yyyy-MM-dd')
            const arr = map.get(key) ?? []
            arr.push(t)
            map.set(key, arr)
        })
        return map
    }, [datedPendingTasks])

    const scheduleTasks = selectedDay ? (taskDueByDate.get(selectedDay) ?? []) : datedPendingTasks

    // ── Time & efficiency ──
    const { todaySeconds, weekSeconds } = useMemo(() => {
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const weekStart = new Date(startOfToday)
        weekStart.setDate(weekStart.getDate() - 6) // rolling 7-day window incl. today
        let today = 0, week = 0
        timeEntries.forEach(e => {
            const secs = e.duration_seconds ?? 0
            const started = new Date(e.started_at)
            if (started >= weekStart) week += secs
            if (started >= startOfToday) today += secs
        })
        return { todaySeconds: today, weekSeconds: week }
    }, [timeEntries])

    const efficiencyToday = todaySeconds / ALLOTTED_DAILY_SECONDS
    const efficiencyWeek = weekSeconds / (ALLOTTED_DAILY_SECONDS * WORK_DAYS_PER_WEEK)

    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

    return (
        <div style={{ padding: '20px 28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
                    Good {greeting}, {userDisplayName || 'there'}
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
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
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
                        <button
                            onClick={() => setShowTasksModal(true)}
                            disabled={pendingTasks.length === 0}
                            style={{
                                marginLeft: 'auto', fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none',
                                fontWeight: 600, padding: 0, cursor: pendingTasks.length ? 'pointer' : 'default', opacity: pendingTasks.length ? 1 : 0.5,
                            }}
                        >
                            View tasks
                        </button>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                        {pendingTasks.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>across {projectsWithPending} project{projectsWithPending !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${allTasks.length ? (pendingTasks.length / allTasks.length) * 100 : 0}%`, background: 'var(--accent)', borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text-muted)' }}>To Do · {todoCount}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(79,70,229,0.1)', color: 'var(--accent-light)' }}>In Progress · {inProgressCount}</span>
                        {overdueTasks.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.12)', color: 'var(--danger)' }}>Overdue · {overdueTasks.length}</span>
                        )}
                    </div>
                </div>

                {/* Time & efficiency */}
                <div style={{ ...CARD, flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Clock size={16} color="var(--accent-light)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Time &amp; Efficiency</span>
                        <Link href="/reports" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                            View reports
                        </Link>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                        {formatHm(todaySeconds)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>logged today</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: efficiencyToday >= 1 ? 'var(--success)' : 'var(--text-muted)', marginBottom: 10 }}>
                        {Math.round(efficiencyToday * 100)}% of 8h target
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{
                            height: '100%', borderRadius: 4,
                            width: `${Math.min(100, efficiencyToday * 100)}%`,
                            background: efficiencyToday >= 1 ? 'var(--success)' : 'var(--accent)',
                        }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                        Last 7 days · {formatHm(weekSeconds)} · {Math.round(efficiencyWeek * 100)}%
                    </span>
                </div>
            </div>

            {/* Quick stat chips */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                    { label: 'Pending Tasks', count: pendingTasks.length, color: '#4f46e5', bg: 'rgba(79,70,229,0.1)' },
                    { label: 'Overdue Tasks', count: overdueTasks.length, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                    { label: 'Tasks Due This Week', count: tasksDueThisWeek.length, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                    { label: 'Active Projects', count: totalActive, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                ].map(chip => (
                    <Link key={chip.label} href="/board" style={{
                        ...CARD, padding: '14px 18px', flex: '1 1 200px', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 10, background: chip.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 700, color: chip.color, flexShrink: 0,
                        }}>{chip.count}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{chip.label}</span>
                        <ChevronRight size={16} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />
                    </Link>
                ))}
            </div>

            {/* Schedule: calendar + action items */}
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
                                const dueTasks = taskDueByDate.get(key)
                                const inMonth = isSameMonth(day, calendarMonth)
                                const today = isToday(day)
                                const selected = selectedDay === key
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedDay(prev => prev === key ? null : (dueTasks ? key : null))}
                                        style={{
                                            aspectRatio: '1', border: 'none', borderRadius: 8, cursor: dueTasks ? 'pointer' : 'default',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                            background: selected ? 'var(--accent)' : today ? 'var(--accent-dim)' : 'transparent',
                                            color: selected ? 'white' : !inMonth ? 'var(--text-dim)' : 'var(--text)',
                                            fontWeight: today || selected ? 700 : 500, fontSize: 12,
                                        }}
                                    >
                                        {format(day, 'd')}
                                        {dueTasks && (
                                            <div style={{ display: 'flex', gap: 1 }}>
                                                {dueTasks.slice(0, 3).map((t, i) => (
                                                    <div key={i} style={{
                                                        width: 4, height: 4, borderRadius: '50%',
                                                        background: selected ? 'white' : isTaskOverdue(t.due_at, t.due_has_time) ? 'var(--danger)' : 'var(--accent)',
                                                    }} />
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
                                ← Show all action items
                            </button>
                        )}
                    </div>

                    {/* Action items — pending tasks with a due date (overdue + upcoming) */}
                    <div style={{ flex: '1 1 400px', minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                {selectedDay ? `Due ${format(new Date(selectedDay), 'MMM d')}` : 'Action Items'}
                            </span>
                            {overdueTasks.length > 0 && !selectedDay && (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.12)', color: 'var(--danger)' }}>
                                    {overdueTasks.length} overdue
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
                            {scheduleTasks.length === 0 && (
                                <div style={{ ...CARD, gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                                    <CalendarClock size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                                    <p style={{ fontSize: 13 }}>{selectedDay ? 'No action items due on this date.' : 'No action items with a due date yet.'}</p>
                                </div>
                            )}
                            {scheduleTasks.map(t => {
                                const overdue = isTaskOverdue(t.due_at, t.due_has_time)
                                return (
                                    <Link key={t.id} href={`/board?project=${t.projectId}&tab=tasks`} style={{
                                        ...CARD, padding: 16, textDecoration: 'none', display: 'block',
                                        borderColor: overdue ? 'rgba(220,38,38,0.4)' : 'var(--border)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>{t.eventCode || t.projectName}</span>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                                background: t.status === 'In Progress' ? 'rgba(79,70,229,0.12)' : 'var(--surface2)',
                                                color: t.status === 'In Progress' ? 'var(--accent-light)' : 'var(--text-muted)',
                                            }}>{t.status}</span>
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                            <CalendarDays size={13} />
                                            {formatTaskDue(t.due_at, t.due_has_time)}{overdue ? ' · overdue' : ''}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending tasks modal — grouped by project code, ordered by urgency */}
            {showTasksModal && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) setShowTasksModal(false) }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(16,24,40,0.5)', backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                    }}
                >
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                        width: '100%', maxWidth: 640, maxHeight: '82vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.35)', overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                            <ListTodo size={18} color="var(--accent-light)" />
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Pending Tasks</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                                {pendingTasks.length} across {projectsWithPending} project{projectsWithPending !== 1 ? 's' : ''}
                            </span>
                            <button onClick={() => setShowTasksModal(false)} className="btn-icon btn-sm" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        {/* Body */}
                        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {pendingByProject.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
                                    <CalendarClock size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                                    <p style={{ fontSize: 13 }}>No pending tasks. Nice work!</p>
                                </div>
                            )}
                            {pendingByProject.map(group => (
                                <div key={group.projectId}>
                                    {/* Group header — project code */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.02em' }}>{group.code}</span>
                                        {group.projectName && group.code !== group.projectName && (
                                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{group.projectName}</span>
                                        )}
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{group.tasks.length}</span>
                                    </div>
                                    {/* Task rows — click opens the project detail on the Tasks tab */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {group.tasks.map(t => {
                                            const overdue = isTaskOverdue(t.due_at, t.due_has_time)
                                            const due = formatTaskDue(t.due_at, t.due_has_time)
                                            return (
                                                <Link
                                                    key={t.id}
                                                    href={`/board?project=${t.projectId}&tab=tasks`}
                                                    onClick={() => setShowTasksModal(false)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textDecoration: 'none',
                                                        borderRadius: 10, border: '1px solid', borderColor: overdue ? 'rgba(220,38,38,0.4)' : 'var(--border)',
                                                        background: 'var(--surface2)',
                                                    }}
                                                >
                                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                                                    {due && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: overdue ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                            <CalendarDays size={12} />
                                                            {due}{overdue ? ' · overdue' : ''}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                                                        background: t.status === 'In Progress' ? 'rgba(79,70,229,0.12)' : 'var(--surface)',
                                                        color: t.status === 'In Progress' ? 'var(--accent-light)' : 'var(--text-muted)',
                                                    }}>{t.status}</span>
                                                    <ChevronRight size={14} color="var(--text-dim)" />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
