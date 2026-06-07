'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { formatDuration } from '@/lib/utils'
import ProjectDetailPanel from '@/components/board/ProjectDetailPanel'
import { Play, Square, Tag, Calendar, Clock, ChevronDown, MoreHorizontal, Trash2, RefreshCw } from 'lucide-react'

interface Stage { id: string; name: string; color: string }
interface Project {
    id: string
    name: string
    event_code?: string
    stage?: Stage | null
    tasks?: { id: string; name: string }[]
    [key: string]: unknown
}

interface TimeEntry {
    id: string
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    notes: string | null
    project_id: string | null
    task_id: string | null
    project?: {
        id: string
        name: string
        event_code?: string
        stage?: Stage | null
    } | null
}

interface TimeTrackerClientProps {
    userId: string
    userDisplayName?: string
    initialProjects: Project[]
    initialTimeEntries: TimeEntry[]
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDurationHM(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

function getDayLabel(dateStr: string) {
    const d = new Date(dateStr)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const entryDay = new Date(d); entryDay.setHours(0, 0, 0, 0)

    if (entryDay.getTime() === today.getTime()) return 'Today'
    if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getDayKey(dateStr: string) {
    return new Date(dateStr).toISOString().split('T')[0]
}

export default function TimeTrackerClient({ userId, userDisplayName, initialProjects, initialTimeEntries }: TimeTrackerClientProps) {
    const supabase = createClient()
    const { timer, startTimer, stopTimer, selection, setSelection, displayTime } = useTimer()

    const [projects, setProjects] = useState(initialProjects)
    const [timeEntries, setTimeEntries] = useState(initialTimeEntries)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null)
    const [fullProjectData, setFullProjectData] = useState<Project | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    // Sync description from running timer
    useEffect(() => {
        if (timer.isRunning) {
            setDescription(timer.taskName || '')
            if (timer.projectId) setSelection({ projectId: timer.projectId, taskId: timer.taskId ?? null })
        }
    }, [timer.isRunning, timer.taskName, timer.projectId, timer.taskId, setSelection])

    const refreshEntries = useCallback(async () => {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const { data } = await supabase
            .from('time_entries')
            .select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))')
            .eq('user_id', userId)
            .gte('started_at', sevenDaysAgo.toISOString())
            .order('started_at', { ascending: false })
        if (data) setTimeEntries(data as unknown as TimeEntry[])
    }, [supabase, userId])

    const handleStart = useCallback(() => {
        if (!selection.projectId) return
        const p = projects.find(pr => pr.id === selection.projectId)
        const t = p?.tasks?.find(tk => tk.id === selection.taskId)
        startTimer({
            projectId: selection.projectId,
            projectName: p?.name,
            taskId: selection.taskId ?? undefined,
            taskName: t?.name || description || undefined,
            mode: selection.taskId ? 'task' : 'project',
        })
    }, [selection, projects, description, startTimer])

    const handleStop = useCallback(async () => {
        setLoading(true)
        await stopTimer(description || undefined)
        await refreshEntries()
        setDescription('')
        setLoading(false)
    }, [stopTimer, description, refreshEntries])

    const handleDelete = useCallback(async (id: string) => {
        await supabase.from('time_entries').delete().eq('id', id)
        setTimeEntries(prev => prev.filter(e => e.id !== id))
        setOpenMenuId(null)
    }, [supabase])

    const handleResume = useCallback((entry: TimeEntry) => {
        if (!entry.project_id) return
        const p = projects.find(pr => pr.id === entry.project_id)
        setSelection({ projectId: entry.project_id, taskId: entry.task_id ?? null })
        setDescription(entry.notes || '')
        startTimer({
            projectId: entry.project_id,
            projectName: p?.name,
            taskId: entry.task_id ?? undefined,
            taskName: entry.notes || undefined,
            mode: entry.task_id ? 'task' : 'project',
        })
    }, [projects, startTimer, setSelection])

    const openProjectDetail = useCallback(async (projectId: string) => {
        const { data } = await supabase.from('projects').select(`
            *,
            stage:stages(id, name, color),
            tasks(id, status, name, estimated_minutes),
            checklist_items(id, checked, text, position),
            time_entries(duration_seconds, started_at)
        `).eq('id', projectId).single()
        if (data) {
            setFullProjectData(data as Project)
            setSelectedProjectForDetail(data as Project)
        }
    }, [supabase])

    // Group entries by day
    const grouped: { key: string; label: string; entries: TimeEntry[]; total: number }[] = []
    const dayMap = new Map<string, TimeEntry[]>()
    for (const e of timeEntries) {
        const key = getDayKey(e.started_at)
        if (!dayMap.has(key)) dayMap.set(key, [])
        dayMap.get(key)!.push(e)
    }
    for (const [key, entries] of dayMap) {
        const label = getDayLabel(entries[0].started_at)
        const total = entries.reduce((s, e) => s + (e.duration_seconds || 0), 0)
        grouped.push({ key, label, entries, total })
    }

    const selectedProject = projects.find(p => p.id === selection.projectId)
    const tasks = selectedProject?.tasks || []

    // Get all stages for the ProjectDetailPanel
    const [stages, setStages] = useState<Stage[]>([])
    const [clients, setClients] = useState<{ id: string; name: string }[]>([])
    useEffect(() => {
        supabase.from('stages').select('*').eq('user_id', userId).order('position').then(({ data }) => { if (data) setStages(data) })
        supabase.from('clients').select('*').eq('user_id', userId).order('name').then(({ data }) => { if (data) setClients(data) })
    }, [supabase, userId])

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            {/* Top Timer Bar - Clockify style */}
            <div style={{
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                padding: '0 24px',
                flexShrink: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 64 }}>
                    {/* Description Input */}
                    <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !timer.isRunning && handleStart()}
                        placeholder="What are you working on?"
                        disabled={timer.isRunning}
                        style={{
                            flex: 1, border: 'none', outline: 'none', background: 'transparent',
                            fontSize: 15, color: 'var(--text)', fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                        }}
                    />

                    {/* Project selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid var(--border)' }}>
                        <Tag size={15} color="var(--text-dim)" />
                        <select
                            value={selection.projectId || ''}
                            onChange={e => setSelection({ projectId: e.target.value || null, taskId: null })}
                            disabled={timer.isRunning}
                            style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 14, color: selection.projectId ? 'var(--accent-light)' : 'var(--text-dim)',
                                fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontWeight: selection.projectId ? 600 : 400,
                                minWidth: 140
                            }}
                        >
                            <option value="">Project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.event_code ? `[${p.event_code}] ` : ''}{p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Task selector (if project selected) */}
                    {tasks.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid var(--border)' }}>
                            <select
                                value={selection.taskId || ''}
                                onChange={e => setSelection({ ...selection, taskId: e.target.value || null })}
                                disabled={timer.isRunning}
                                style={{
                                    border: 'none', outline: 'none', background: 'transparent',
                                    fontSize: 14, color: selection.taskId ? 'var(--text)' : 'var(--text-dim)',
                                    fontFamily: 'Inter, sans-serif', cursor: 'pointer', minWidth: 120
                                }}
                            >
                                <option value="">Task (optional)</option>
                                {tasks.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Timer display */}
                    <div style={{
                        padding: '0 20px', borderLeft: '1px solid var(--border)',
                        fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                        color: timer.isRunning ? '#16a34a' : 'var(--text-dim)',
                        letterSpacing: '0.05em', minWidth: 110, textAlign: 'center'
                    }}>
                        {displayTime}
                    </div>

                    {/* Start / Stop */}
                    <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
                        {timer.isRunning ? (
                            <button
                                onClick={handleStop}
                                disabled={loading}
                                style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: '#dc2626', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <Square size={18} color="white" fill="white" />
                            </button>
                        ) : (
                            <button
                                onClick={handleStart}
                                disabled={!selection.projectId}
                                style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: selection.projectId ? '#6366f1' : 'var(--border)',
                                    border: 'none', cursor: selection.projectId ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: selection.projectId ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <Play size={18} color="white" fill="white" style={{ marginLeft: 2 }} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Greeting */}
            <div style={{ padding: '24px 28px 8px' }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {userDisplayName || 'there'} 👋
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Week total pill */}
            {timeEntries.length > 0 && (() => {
                const weekTotal = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)
                return (
                    <div style={{ padding: '0 28px 16px' }}>
                        <span style={{
                            fontSize: 12, fontWeight: 600, color: 'var(--accent-light)',
                            background: 'var(--accent-dim)', padding: '4px 12px', borderRadius: 20,
                            border: '1px solid rgba(99,102,241,0.2)'
                        }}>
                            Week total: {formatDurationHM(weekTotal)}
                        </span>
                    </div>
                )
            })()}

            {/* Time entries list */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 24px' }}>
                {grouped.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-dim)' }}>
                        <Clock size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--text-muted)' }}>No time entries yet</p>
                        <p style={{ fontSize: 13 }}>Select a project above and press Start to begin tracking.</p>
                    </div>
                ) : (
                    grouped.map(group => (
                        <div key={group.key} style={{ marginBottom: 24 }}>
                            {/* Day header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 16px', marginBottom: 4
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                                    {group.label}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                                    Total: {formatDurationHM(group.total)}
                                </span>
                            </div>

                            {/* Entry rows */}
                            <div style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                                {group.entries.map((entry, idx) => {
                                    const proj = entry.project
                                    return (
                                        <div
                                            key={entry.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 16,
                                                padding: '14px 20px',
                                                borderBottom: idx < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                        >
                                            {/* Description */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    fontSize: 14, color: entry.notes ? 'var(--text)' : 'var(--text-dim)',
                                                    fontStyle: entry.notes ? 'normal' : 'italic'
                                                }}>
                                                    {entry.notes || 'No description'}
                                                </span>
                                            </div>

                                            {/* Project / Event Code badge */}
                                            {proj && (
                                                <button
                                                    onClick={() => proj.id && openProjectDetail(proj.id)}
                                                    title="View project details"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '4px 10px', borderRadius: 6, border: 'none',
                                                        background: proj.stage?.color ? `${proj.stage.color}15` : 'var(--accent-dim)',
                                                        cursor: 'pointer', flexShrink: 0,
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                                >
                                                    {proj.stage?.color && (
                                                        <span style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: proj.stage.color, flexShrink: 0, display: 'inline-block'
                                                        }} />
                                                    )}
                                                    <span style={{
                                                        fontSize: 12, fontWeight: 600,
                                                        color: proj.stage?.color || 'var(--accent-light)',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {proj.event_code ? `${proj.event_code}` : proj.name}
                                                    </span>
                                                </button>
                                            )}

                                            {/* Time range */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                fontSize: 13, color: 'var(--text-muted)', flexShrink: 0
                                            }}>
                                                <Calendar size={13} />
                                                <span>
                                                    {formatTime(entry.started_at)}
                                                    {entry.ended_at ? ` - ${formatTime(entry.ended_at)}` : ' - running'}
                                                </span>
                                            </div>

                                            {/* Duration */}
                                            <div style={{
                                                fontSize: 16, fontWeight: 700, color: 'var(--text)',
                                                fontFamily: 'monospace', minWidth: 52, textAlign: 'right', flexShrink: 0
                                            }}>
                                                {entry.duration_seconds ? formatDurationHM(entry.duration_seconds) : '—'}
                                            </div>

                                            {/* Resume button */}
                                            <button
                                                onClick={() => handleResume(entry)}
                                                disabled={timer.isRunning}
                                                title="Resume"
                                                style={{
                                                    width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
                                                    background: 'transparent', cursor: timer.isRunning ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: timer.isRunning ? 0.4 : 1, transition: 'all 0.15s', flexShrink: 0,
                                                    color: 'var(--text-muted)'
                                                }}
                                                onMouseEnter={e => { if (!timer.isRunning) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                            >
                                                <Play size={12} fill="currentColor" />
                                            </button>

                                            {/* More menu */}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
                                                        background: 'transparent', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--text-muted)', transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </button>
                                                {openMenuId === entry.id && (
                                                    <div style={{
                                                        position: 'absolute', right: 0, top: 36, zIndex: 100,
                                                        background: 'var(--surface)', border: '1px solid var(--border)',
                                                        borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                                        minWidth: 140, overflow: 'hidden'
                                                    }}>
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
                                                            style={{
                                                                width: '100%', padding: '10px 16px',
                                                                display: 'flex', alignItems: 'center', gap: 8,
                                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                                fontSize: 13, color: '#dc2626', fontFamily: 'Inter, sans-serif',
                                                                textAlign: 'left'
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.05)'}
                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                        >
                                                            <Trash2 size={13} />
                                                            Delete entry
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Click outside to close menu */}
            {openMenuId && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setOpenMenuId(null)}
                />
            )}

            {/* Project Detail Panel */}
            {selectedProjectForDetail && fullProjectData && (
                <ProjectDetailPanel
                    project={fullProjectData as unknown as Parameters<typeof ProjectDetailPanel>[0]['project']}
                    userId={userId}
                    stages={stages}
                    clients={clients}
                    onClose={() => { setSelectedProjectForDetail(null); setFullProjectData(null) }}
                    onUpdated={async () => {
                        setSelectedProjectForDetail(null)
                        setFullProjectData(null)
                        await refreshEntries()
                    }}
                />
            )}
        </div>
    )
}
