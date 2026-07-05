'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import ProjectDetailPanel from '@/components/board/ProjectDetailPanel'
import {
    Play, Square, Tag, Calendar, Clock, MoreHorizontal,
    Trash2, Copy, Search, Plus, X, AlertTriangle, ChevronDown
} from 'lucide-react'

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

// ─── Searchable Project Dropdown ───────────────────────────────────────────────
function ProjectDropdown({
    projects,
    selectedId,
    disabled,
    onSelect,
    onCreateNew,
}: {
    projects: Project[]
    selectedId: string | null
    disabled: boolean
    onSelect: (id: string | null) => void
    onCreateNew: () => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const selected = projects.find(p => p.id === selectedId)
    const filtered = projects.filter(p => {
        const q = search.toLowerCase()
        return (
            p.name.toLowerCase().includes(q) ||
            (p.event_code ?? '').toLowerCase().includes(q)
        )
    })

    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 50)
    }, [open])

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid var(--border)' }}>
            <Tag size={15} color="var(--text-dim)" />
            <button
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: 14, fontFamily: 'inherit', padding: '4px 0',
                    color: selected ? 'var(--accent)' : 'var(--text-dim)',
                    fontWeight: selected ? 600 : 400,
                    opacity: disabled ? 0.6 : 1,
                    minWidth: 140, maxWidth: 220, textAlign: 'left',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}
            >
                {selected ? (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.event_code ? `[${selected.event_code}] ` : ''}{selected.name}
                    </span>
                ) : 'Project'}
                <ChevronDown size={13} style={{ flexShrink: 0, marginLeft: 2 }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 8,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, boxShadow: 'var(--shadow-md)',
                    width: 280, overflow: 'hidden'
                }}>
                    {/* Search input */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={14} color="var(--text-dim)" />
                        <input
                            ref={searchRef}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search projects..."
                            style={{
                                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 13, color: 'var(--text)', fontFamily: 'inherit'
                            }}
                        />
                        {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}><X size={13} /></button>}
                    </div>

                    {/* Project list */}
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                        {/* Clear selection */}
                        {selectedId && (
                            <button
                                onClick={() => { onSelect(null); setOpen(false); setSearch('') }}
                                style={{
                                    width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    fontSize: 13, color: 'var(--text-muted)', fontFamily: 'inherit', textAlign: 'left'
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <X size={13} /> Clear selection
                            </button>
                        )}

                        {filtered.length === 0 && (
                            <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
                                No projects found
                            </div>
                        )}

                        {filtered.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onSelect(p.id); setOpen(false); setSearch('') }}
                                style={{
                                    width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
                                    background: p.id === selectedId ? 'var(--accent-dim)' : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                                    transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => { if (p.id !== selectedId) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                                onMouseLeave={e => { if (p.id !== selectedId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                                {p.stage?.color && (
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stage.color, flexShrink: 0 }} />
                                )}
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.event_code && <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 4 }}>[{p.event_code}]</span>}
                                    <span style={{ color: 'var(--text)', fontWeight: p.id === selectedId ? 600 : 400 }}>{p.name}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Create new project */}
                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
                        <button
                            onClick={() => { setOpen(false); setSearch(''); onCreateNew() }}
                            style={{
                                width: '100%', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8,
                                background: 'transparent', border: '1px dashed var(--border2)',
                                borderRadius: 8, cursor: 'pointer',
                                fontSize: 13, color: 'var(--accent)', fontFamily: 'inherit',
                                fontWeight: 600, transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <Plus size={14} /> Create new project
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Quick Create Project Modal ────────────────────────────────────────────────
function QuickCreateModal({
    onClose,
    onCreate,
}: {
    onClose: () => void
    onCreate: (project: Project) => void
}) {
    const [eventCode, setEventCode] = useState('')
    const [projectName, setProjectName] = useState('')
    const [clientName, setClientName] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const supabase = createClient()

    const handleCreate = async () => {
        if (!eventCode.trim()) { setError('Event ID is required'); return }
        if (!projectName.trim()) { setError('Project name is required'); return }
        setSaving(true)
        setError('')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not authenticated'); setSaving(false); return }

        const { data, error: err } = await supabase.from('projects').insert({
            user_id: user.id,
            name: projectName.trim(),
            event_code: eventCode.trim().toUpperCase(),
            client: clientName.trim() || null,
            priority: 'Medium',
        }).select('id, name, event_code, stage, tasks').single()

        if (err) { setError(err.message); setSaving(false); return }
        onCreate({ ...data, stage: null, tasks: [] } as Project)
        onClose()
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(16,24,40,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
            <div style={{
                background: 'var(--surface)', borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                width: '100%', maxWidth: 440, padding: 28
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Quick Create Project</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Fill in full details later — you can start tracking now.
                        </p>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Event / Project ID <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            className="input"
                            value={eventCode}
                            onChange={e => setEventCode(e.target.value)}
                            placeholder="e.g. KVNNNFQKH8F"
                            autoFocus
                            style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Project Name <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            className="input"
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            placeholder="e.g. Rwanda Tax Retreat 2026"
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Client Name <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <input
                            className="input"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            placeholder="e.g. Ivy M Manyasi"
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                    </div>

                    {error && (
                        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{error}</p>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                            className="btn btn-ghost"
                            onClick={onClose}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={saving}
                            style={{ flex: 1 }}
                        >
                            {saving ? 'Creating…' : 'Create & Select'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Incomplete Project Guard Modal ───────────────────────────────────────────
function CompleteProjectModal({
    project,
    onComplete,
    onSkip,
    onClose,
}: {
    project: Project
    onComplete: () => void
    onSkip: () => void
    onClose: () => void
}) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(16,24,40,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
            <div style={{
                background: 'var(--surface)', borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                width: '100%', maxWidth: 420, padding: 28
            }}>
                <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle size={20} color="var(--warning)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Complete Project Details</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--text)' }}>{project.name}</strong> was created quickly and still needs full details (stage, priority, dates) before logging more time.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    <button className="btn btn-ghost" onClick={onSkip}
                        style={{ flex: 1, color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                        Skip for now
                    </button>
                    <button className="btn btn-primary" onClick={onComplete} style={{ flex: 1 }}>
                        Fill Details
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TimeTrackerClient({ userId, userDisplayName, initialProjects, initialTimeEntries }: TimeTrackerClientProps) {
    const supabase = createClient()
    const { timer, startTimer, stopTimer, selection, setSelection, displayTime } = useTimer()

    const [projects, setProjects] = useState(initialProjects)
    const [timeEntries, setTimeEntries] = useState(initialTimeEntries)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)

    // Project detail panel
    const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null)
    const [fullProjectData, setFullProjectData] = useState<Project | null>(null)

    // Entry actions menu
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    // Modals
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [incompletePrompt, setIncompletePrompt] = useState<Project | null>(null)
    const [pendingStart, setPendingStart] = useState(false)

    // Track quick-created project IDs (need completion before 2nd timer)
    const [quickCreatedIds, setQuickCreatedIds] = useState<Set<string>>(new Set())

    // Stages & clients for ProjectDetailPanel
    const [stages, setStages] = useState<Stage[]>([])
    const [clients, setClients] = useState<{ id: string; name: string }[]>([])

    useEffect(() => {
        supabase.from('stages').select('*').eq('user_id', userId).order('position').then(({ data }) => { if (data) setStages(data) })
        supabase.from('clients').select('*').eq('user_id', userId).order('name').then(({ data }) => { if (data) setClients(data) })
    }, [supabase, userId])

    // Sync the description field and selection from the running timer. This mirrors the
    // external timer (from TimerContext) into local UI state, so it stays an effect.
    useEffect(() => {
        if (timer.isRunning) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local UI state from the external timer store
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

    const doStart = useCallback(() => {
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

    const handleStart = useCallback(() => {
        if (!selection.projectId) return
        // Check if quick-created & has existing entries
        const hasEntries = timeEntries.some(e => e.project_id === selection.projectId)
        if (quickCreatedIds.has(selection.projectId) && hasEntries) {
            const p = projects.find(pr => pr.id === selection.projectId)
            if (p) { setIncompletePrompt(p); setPendingStart(true); return }
        }
        doStart()
    }, [selection.projectId, timeEntries, quickCreatedIds, projects, doStart])

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

    const handleDuplicate = useCallback(async (entry: TimeEntry) => {
        const now = new Date()
        const dur = entry.duration_seconds || 0
        const startedAt = new Date(now.getTime() - dur * 1000)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('time_entries').insert({
            user_id: user.id,
            project_id: entry.project_id,
            task_id: entry.task_id,
            started_at: startedAt.toISOString(),
            ended_at: now.toISOString(),
            duration_seconds: dur,
            notes: entry.notes,
        }).select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))').single()
        if (data) setTimeEntries(prev => [data as unknown as TimeEntry, ...prev])
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
            *, stage:stages(id, name, color),
            tasks(id, status, name, estimated_minutes),
            checklist_items(id, checked, text, position),
            time_entries(duration_seconds, started_at)
        `).eq('id', projectId).single()
        if (data) {
            setFullProjectData(data as Project)
            setSelectedProjectForDetail(data as Project)
        }
    }, [supabase])

    const handleQuickCreated = (project: Project) => {
        setProjects(prev => [project, ...prev])
        setQuickCreatedIds(prev => new Set([...prev, project.id]))
        setSelection({ projectId: project.id, taskId: null })
    }

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

    const weekTotal = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

            {/* ── Sticky Timer Bar ─────────────────────────────────────────── */}
            <div style={{
                background: 'var(--surface)',
                borderBottom: '2px solid var(--border)',
                padding: '0 20px',
                flexShrink: 0,
                position: 'sticky', top: 0, zIndex: 50,
                boxShadow: 'var(--shadow-xs)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', height: 68 }}>

                    {/* Description */}
                    <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !timer.isRunning && handleStart()}
                        placeholder="What are you working on?"
                        disabled={timer.isRunning}
                        style={{
                            flex: 1, border: 'none', outline: 'none', background: 'transparent',
                            fontSize: 15, color: 'var(--text)', fontFamily: 'inherit',
                            minWidth: 0
                        }}
                    />

                    {/* Project searchable dropdown */}
                    <ProjectDropdown
                        projects={projects}
                        selectedId={selection.projectId}
                        disabled={timer.isRunning}
                        onSelect={id => setSelection({ projectId: id, taskId: null })}
                        onCreateNew={() => setShowQuickCreate(true)}
                    />

                    {/* Timer display — fixed width, no layout shift */}
                    <div style={{
                        padding: '0 18px', borderLeft: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: timer.isRunning ? 'var(--success)' : 'var(--text-dim)',
                        letterSpacing: '0.04em',
                        width: 118, textAlign: 'center', flexShrink: 0,
                        transition: 'color 0.3s'
                    }}>
                        {displayTime}
                    </div>

                    {/* Start / Stop button */}
                    <div style={{ paddingLeft: 16 }}>
                        {timer.isRunning ? (
                            <button
                                onClick={handleStop}
                                disabled={loading}
                                title="Stop timer"
                                style={{
                                    width: 46, height: 46, borderRadius: '50%',
                                    background: 'var(--danger)', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: 'var(--shadow-xs)',
                                    transition: 'all 0.15s', flexShrink: 0
                                }}
                            >
                                <Square size={18} color="white" fill="white" />
                            </button>
                        ) : (
                            <button
                                onClick={handleStart}
                                disabled={!selection.projectId}
                                title={selection.projectId ? 'Start timer' : 'Select a project first'}
                                style={{
                                    width: 46, height: 46, borderRadius: '50%',
                                    background: selection.projectId ? 'var(--accent)' : 'var(--surface2)',
                                    border: 'none',
                                    cursor: selection.projectId ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: selection.projectId ? 'var(--shadow-sm)' : 'none',
                                    transition: 'all 0.15s', flexShrink: 0
                                }}
                            >
                                <Play size={18} color={selection.projectId ? 'white' : 'var(--text-dim)'} fill={selection.projectId ? 'white' : 'var(--text-dim)'} style={{ marginLeft: 2 }} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Greeting & week total ─────────────────────────────────────── */}
            <div style={{ padding: '22px 28px 4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {userDisplayName || 'there'}
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {weekTotal > 0 && (
                    <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                        background: 'rgba(79,70,229,0.08)', padding: '5px 14px',
                        borderRadius: 20, border: '1px solid rgba(79,70,229,0.2)',
                        flexShrink: 0
                    }}>
                        Week total: {formatDurationHM(weekTotal)}
                    </span>
                )}
            </div>

            {/* ── Time entries list ─────────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 32px' }}>
                {grouped.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-dim)' }}>
                        <Clock size={40} style={{ margin: '0 auto 16px', opacity: 0.25, display: 'block' }} />
                        <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--text-muted)' }}>No time entries yet</p>
                        <p style={{ fontSize: 13 }}>Select a project above and press Start to begin tracking.</p>
                    </div>
                ) : (
                    grouped.map(group => (
                        <div key={group.key} style={{ marginBottom: 24 }}>
                            {/* Day header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 14px', marginBottom: 6
                            }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {group.label}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                                    Total: {formatDurationHM(group.total)}
                                </span>
                            </div>

                            {/* Entries card */}
                            <div style={{
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 12, overflow: 'hidden',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                            }}>
                                {group.entries.map((entry, idx) => {
                                    const proj = entry.project
                                    return (
                                        <div
                                            key={entry.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 14,
                                                padding: '13px 18px',
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

                                            {/* Event code badge — click to open project detail */}
                                            {proj && (
                                                <button
                                                    onClick={() => proj.id && openProjectDetail(proj.id)}
                                                    title="View project details"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '4px 10px', borderRadius: 6, border: 'none',
                                                        background: proj.stage?.color ? `${proj.stage.color}18` : 'rgba(79,70,229,0.1)',
                                                        cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                                >
                                                    {proj.stage?.color && (
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: proj.stage.color, flexShrink: 0, display: 'inline-block' }} />
                                                    )}
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: proj.stage?.color || 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                        {proj.event_code || proj.name}
                                                    </span>
                                                </button>
                                            )}

                                            {/* Time range */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                <Calendar size={13} />
                                                <span>
                                                    {formatTime(entry.started_at)}
                                                    {entry.ended_at ? ` – ${formatTime(entry.ended_at)}` : ' – running'}
                                                </span>
                                            </div>

                                            {/* Duration */}
                                            <div style={{
                                                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                                                fontFamily: 'var(--font-mono)',
                                                minWidth: 52, textAlign: 'right', flexShrink: 0
                                            }}>
                                                {entry.duration_seconds ? formatDurationHM(entry.duration_seconds) : '—'}
                                            </div>

                                            {/* Resume */}
                                            <button
                                                onClick={() => handleResume(entry)}
                                                disabled={timer.isRunning}
                                                title="Resume this entry"
                                                style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    border: '1px solid var(--border)', background: 'transparent',
                                                    cursor: timer.isRunning ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: timer.isRunning ? 0.35 : 1, transition: 'all 0.15s',
                                                    flexShrink: 0, color: 'var(--text-muted)'
                                                }}
                                                onMouseEnter={e => { if (!timer.isRunning) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                            >
                                                <Play size={11} fill="currentColor" />
                                            </button>

                                            {/* ⋯ More menu */}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: '50%',
                                                        border: '1px solid var(--border)', background: 'transparent',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                                                        borderRadius: 10, boxShadow: 'var(--shadow-md)',
                                                        minWidth: 160, overflow: 'hidden'
                                                    }}>
                                                        <button
                                                            onClick={() => handleDuplicate(entry)}
                                                            style={{
                                                                width: '100%', padding: '10px 16px',
                                                                display: 'flex', alignItems: 'center', gap: 9,
                                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                                fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left'
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                        >
                                                            <Copy size={13} />
                                                            Duplicate entry
                                                        </button>
                                                        <div style={{ height: 1, background: 'var(--border)' }} />
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
                                                            style={{
                                                                width: '100%', padding: '10px 16px',
                                                                display: 'flex', alignItems: 'center', gap: 9,
                                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                                fontSize: 13, color: 'var(--danger)', fontFamily: 'inherit', textAlign: 'left'
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

            {/* Click outside to close entry menu */}
            {openMenuId && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenuId(null)} />
            )}

            {/* Quick Create Modal */}
            {showQuickCreate && (
                <QuickCreateModal
                    onClose={() => setShowQuickCreate(false)}
                    onCreate={handleQuickCreated}
                />
            )}

            {/* Incomplete project guard */}
            {incompletePrompt && (
                <CompleteProjectModal
                    project={incompletePrompt}
                    onClose={() => { setIncompletePrompt(null); setPendingStart(false) }}
                    onSkip={() => {
                        setIncompletePrompt(null)
                        // Remove from quick-created so they won't be prompted again
                        setQuickCreatedIds(prev => { const n = new Set(prev); n.delete(incompletePrompt.id); return n })
                        if (pendingStart) doStart()
                        setPendingStart(false)
                    }}
                    onComplete={() => {
                        setIncompletePrompt(null)
                        setPendingStart(false)
                        openProjectDetail(incompletePrompt.id)
                    }}
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
                        // If they just completed a quick-created project, remove from set
                        if (fullProjectData?.id) {
                            setQuickCreatedIds(prev => { const n = new Set(prev); n.delete(fullProjectData.id as string); return n })
                        }
                        await refreshEntries()
                        // Resume timer if it was pending
                        if (pendingStart) { doStart(); setPendingStart(false) }
                    }}
                />
            )}
        </div>
    )
}
