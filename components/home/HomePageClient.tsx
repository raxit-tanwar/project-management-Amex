'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import BoardClient from '@/components/board/BoardClient'
import ProjectDetailPanel from '@/components/board/ProjectDetailPanel'
import {
    Play, Square, Tag, Calendar, Clock,
    MoreHorizontal, Trash2, Copy, Search,
    Plus, X, AlertTriangle, ChevronDown,
    TableProperties, LayoutGrid
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stage { id: string; name: string; color: string; position: number }
interface Client { id: string; name: string }
interface Project {
    id: string; name: string; event_code?: string; stage_id?: string
    stage?: Stage | null; tasks?: { id: string; name: string }[]
    checklist_items?: { id: string; checked: boolean; text: string; position: number }[]
    time_entries?: { duration_seconds: number; started_at: string }[]
    [key: string]: unknown
}
interface TimeEntry {
    id: string; started_at: string; ended_at: string | null
    duration_seconds: number | null; notes: string | null
    project_id: string | null; task_id: string | null
    project?: { id: string; name: string; event_code?: string; stage?: { name: string; color: string } | null } | null
}
interface HomePageClientProps {
    userId: string; userDisplayName?: string
    initialProjects: Project[]; initialTimeEntries: TimeEntry[]
    initialStages: Stage[]; initialClients: Client[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(d: string) {
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatHM(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
    return `${h}:${String(m).padStart(2, '0')} hr`
}
function dayLabel(d: string) {
    const date = new Date(d), today = new Date(), yesterday = new Date()
    today.setHours(0, 0, 0, 0); yesterday.setHours(0, 0, 0, 0)
    yesterday.setDate(yesterday.getDate() - 1)
    const entry = new Date(date); entry.setHours(0, 0, 0, 0)
    if (entry.getTime() === today.getTime()) return 'Today'
    if (entry.getTime() === yesterday.getTime()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function dayKey(d: string) { return new Date(d).toISOString().split('T')[0] }

// ─── Searchable Project Dropdown ──────────────────────────────────────────────
function ProjectDropdown({ projects, selectedId, disabled, onSelect, onCreateNew }: {
    projects: Project[]; selectedId: string | null; disabled: boolean
    onSelect: (id: string | null) => void; onCreateNew: () => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const selected = projects.find(p => p.id === selectedId)
    const filtered = projects.filter(p => {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || (p.event_code ?? '').toLowerCase().includes(q)
    })

    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40) }, [open])
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        if (open) document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={14} color="var(--text-dim)" />
            <button
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
                    fontSize: 14, fontFamily: 'Inter, sans-serif',
                    color: selected ? '#6366f1' : 'var(--text-dim)',
                    fontWeight: selected ? 600 : 400,
                    opacity: disabled ? 0.7 : 1,
                    maxWidth: 220, padding: '4px 0'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? `${selected.event_code ? `[${selected.event_code}] ` : ''}${selected.name}` : 'Project'}
                </span>
                <ChevronDown size={12} style={{ flexShrink: 0 }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 9999,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.14)',
                    width: 290, overflow: 'hidden'
                }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={14} color="var(--text-dim)" />
                        <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name or event code…"
                            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--text)' }} />
                        {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}><X size={13} /></button>}
                    </div>

                    <div style={{ maxHeight: 256, overflowY: 'auto' }}>
                        {selectedId && (
                            <button onClick={() => { onSelect(null); setOpen(false); setSearch('') }}
                                style={{ width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <X size={13} /> Clear selection
                            </button>
                        )}
                        {filtered.length === 0 && <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>No projects found</div>}
                        {filtered.map(p => (
                            <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); setSearch('') }}
                                style={{
                                    width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
                                    background: p.id === selectedId ? 'rgba(99,102,241,0.08)' : 'transparent',
                                    border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif', textAlign: 'left', transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => { if (p.id !== selectedId) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                                onMouseLeave={e => { if (p.id !== selectedId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                {p.stage?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stage.color, flexShrink: 0 }} />}
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.event_code && <span style={{ color: '#6366f1', fontWeight: 600, marginRight: 5 }}>[{p.event_code}]</span>}
                                    <span style={{ color: 'var(--text)', fontWeight: p.id === selectedId ? 600 : 400 }}>{p.name}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
                        <button onClick={() => { setOpen(false); setSearch(''); onCreateNew() }}
                            style={{ width: '100%', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6366f1', fontFamily: 'Inter, sans-serif', fontWeight: 600, transition: 'all 0.15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <Plus size={14} /> Create new project
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Quick Create Modal ────────────────────────────────────────────────────────
function QuickCreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
    const [eventCode, setEventCode] = useState('')
    const [projectName, setProjectName] = useState('')
    const [clientName, setClientName] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const supabase = createClient()

    const handleCreate = async () => {
        if (!eventCode.trim()) { setError('Event ID is required'); return }
        if (!projectName.trim()) { setError('Project name is required'); return }
        setSaving(true); setError('')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not authenticated'); setSaving(false); return }

        const { data, error: err } = await supabase.from('projects').insert({
            user_id: user.id,
            name: projectName.trim(),
            event_code: eventCode.trim().toUpperCase(),
            client: clientName.trim() || null,
            // No priority — removed from schema
        }).select('id, name, event_code').single()

        if (err) { setError(err.message); setSaving(false); return }
        onCreate({ ...data, stage: null, tasks: [] } as Project)
        onClose()
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 440, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Quick Create Project</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Start tracking now — fill full details later on the Board.</p>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Event / Project ID <span style={{ color: '#dc2626' }}>*</span></label>
                        <input className="input" value={eventCode} onChange={e => setEventCode(e.target.value)} placeholder="e.g. KVNNNFQKH8F" autoFocus style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Project Name <span style={{ color: '#dc2626' }}>*</span></label>
                        <input className="input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Rwanda Tax Retreat 2026" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Client Name <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span></label>
                        <input className="input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Ivy M Manyasi" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                    </div>
                    {error && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ flex: 1 }}>{saving ? 'Creating…' : 'Create & Select'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Incomplete project guard ──────────────────────────────────────────────────
function CompleteProjectModal({ project, onComplete, onSkip, onClose }: {
    project: Project; onComplete: () => void; onSkip: () => void; onClose: () => void
}) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, padding: 28 }}>
                <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle size={20} color="#d97706" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Complete Project Details</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--text)' }}>{project.name}</strong> was quick-created. Please fill in its full details before logging more time.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    <button className="btn btn-ghost" onClick={onSkip} style={{ flex: 1, color: '#d97706', borderColor: 'rgba(245,158,11,0.3)' }}>Skip for now</button>
                    <button className="btn btn-primary" onClick={onComplete} style={{ flex: 1 }}>Fill Details</button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function HomePageClient({
    userId, userDisplayName, initialProjects, initialTimeEntries, initialStages, initialClients
}: HomePageClientProps) {
    const supabase = createClient()
    const { timer, startTimer, stopTimer, selection, setSelection, displayTime } = useTimer()

    const [activeTab, setActiveTab] = useState<'timesheet' | 'board'>('timesheet')
    const [projects, setProjects] = useState(initialProjects)
    const [timeEntries, setTimeEntries] = useState(initialTimeEntries)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingEntry, setEditingEntry] = useState<{ id: string; notes: string } | null>(null)

    // Detail panel
    const [detailProject, setDetailProject] = useState<Project | null>(null)
    const [fullDetailData, setFullDetailData] = useState<Project | null>(null)

    // Fixed-position entry action menu
    const [menuState, setMenuState] = useState<{ id: string; x: number; y: number } | null>(null)

    // Modals
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [incompletePrompt, setIncompletePrompt] = useState<Project | null>(null)
    const [pendingStart, setPendingStart] = useState(false)
    const [quickCreatedIds, setQuickCreatedIds] = useState<Set<string>>(new Set())

    // Sync description and project selection when timer first starts
    useEffect(() => {
        if (timer.isRunning) {
            if (timer.projectId) setSelection({ projectId: timer.projectId, taskId: timer.taskId ?? null })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timer.isRunning])

    const refreshEntries = useCallback(async () => {
        const since = new Date(); since.setDate(since.getDate() - 7)
        const { data } = await supabase
            .from('time_entries')
            .select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))')
            .eq('user_id', userId)
            .gte('started_at', since.toISOString())
            .order('started_at', { ascending: false })
        if (data) setTimeEntries(data as unknown as TimeEntry[])
    }, [supabase, userId])

    const doStart = useCallback(() => {
        if (!selection.projectId) return
        const p = projects.find(pr => pr.id === selection.projectId)
        const t = p?.tasks?.find(tk => tk.id === selection.taskId)
        startTimer({ projectId: selection.projectId, projectName: p?.name, taskId: selection.taskId ?? undefined, taskName: t?.name || description || undefined, mode: selection.taskId ? 'task' : 'project' })
    }, [selection, projects, description, startTimer])

    const handleStart = useCallback(() => {
        if (!selection.projectId) return
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
        setLoading(false)
    }, [stopTimer, description, refreshEntries])

    const handleDelete = useCallback(async (id: string) => {
        await supabase.from('time_entries').delete().eq('id', id)
        setTimeEntries(prev => prev.filter(e => e.id !== id))
        setMenuState(null)
    }, [supabase])

    const handleDuplicate = useCallback(async (entry: TimeEntry) => {
        const now = new Date(), dur = entry.duration_seconds || 0
        const startedAt = new Date(now.getTime() - dur * 1000)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('time_entries').insert({
            user_id: user.id, project_id: entry.project_id, task_id: entry.task_id,
            started_at: startedAt.toISOString(), ended_at: now.toISOString(),
            duration_seconds: dur, notes: entry.notes,
        }).select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))').single()
        if (data) setTimeEntries(prev => [data as unknown as TimeEntry, ...prev])
        setMenuState(null)
    }, [supabase])

    const handleSaveEntryNotes = useCallback(async (id: string, notes: string) => {
        await supabase.from('time_entries').update({ notes: notes || null }).eq('id', id)
        setTimeEntries(prev => prev.map(e => e.id === id ? { ...e, notes: notes || null } : e))
        setEditingEntry(null)
    }, [supabase])

    const handleResume = useCallback((entry: TimeEntry) => {
        if (!entry.project_id) return
        const p = projects.find(pr => pr.id === entry.project_id)
        setSelection({ projectId: entry.project_id, taskId: entry.task_id ?? null })
        setDescription(entry.notes || '')
        startTimer({ projectId: entry.project_id, projectName: p?.name, taskId: entry.task_id ?? undefined, taskName: entry.notes || undefined, mode: entry.task_id ? 'task' : 'project' })
    }, [projects, startTimer, setSelection])

    const openProjectDetail = useCallback(async (projectId: string) => {
        const { data } = await supabase.from('projects').select(`
            *, stage:stages(id, name, color),
            tasks(id, status, name, estimated_minutes),
            checklist_items(id, checked, text, position),
            time_entries(duration_seconds, started_at)
        `).eq('id', projectId).single()
        if (data) { setFullDetailData(data as Project); setDetailProject(data as Project) }
    }, [supabase])

    const handleQuickCreated = (project: Project) => {
        setProjects(prev => [project, ...prev])
        setQuickCreatedIds(prev => new Set([...prev, project.id]))
        setSelection({ projectId: project.id, taskId: null })
    }

    // Group time entries by day
    const grouped: { key: string; label: string; entries: TimeEntry[]; total: number }[] = []
    const dayMap = new Map<string, TimeEntry[]>()
    for (const e of timeEntries) {
        const k = dayKey(e.started_at)
        if (!dayMap.has(k)) dayMap.set(k, [])
        dayMap.get(k)!.push(e)
    }
    for (const [k, entries] of dayMap) {
        grouped.push({ key: k, label: dayLabel(entries[0].started_at), entries, total: entries.reduce((s, e) => s + (e.duration_seconds || 0), 0) })
    }

    const selectedProject = projects.find(p => p.id === selection.projectId)
    const tasks = selectedProject?.tasks || []
    const weekTotal = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

            {/* ── Greeting bar ──────────────────────────────────────────────── */}
            <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {userDisplayName || 'there'} 👋
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {weekTotal > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.18)', flexShrink: 0 }}>
                        Week total: {formatHM(weekTotal)}
                    </span>
                )}
            </div>

            {/* ── Timer bar card ─────────────────────────────────────────────── */}
            <div style={{ padding: '0 24px 16px', flexShrink: 0 }}>
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, display: 'flex', alignItems: 'center',
                    height: 56, padding: '0 16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                }}>
                    {/* Description */}
                    <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !timer.isRunning && handleStart()}
                        placeholder="What are you working on?"
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'Inter, sans-serif', minWidth: 0 }}
                    />

                    {/* Divider */}
                    <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 14px', flexShrink: 0 }} />

                    {/* Project dropdown */}
                    <ProjectDropdown
                        projects={projects}
                        selectedId={selection.projectId}
                        disabled={timer.isRunning}
                        onSelect={id => setSelection({ projectId: id, taskId: null })}
                        onCreateNew={() => setShowQuickCreate(true)}
                    />

                    {/* Task dropdown */}
                    {tasks.length > 0 && !timer.isRunning && (
                        <>
                            <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 14px', flexShrink: 0 }} />
                            <select value={selection.taskId || ''} onChange={e => setSelection({ ...selection, taskId: e.target.value || null })}
                                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: selection.taskId ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', minWidth: 110 }}>
                                <option value="">Task (optional)</option>
                                {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </>
                    )}

                    {/* Timer */}
                    <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 14px', flexShrink: 0 }} />
                    <div style={{
                        fontSize: 20, fontWeight: 800, fontFamily: '"Courier New", monospace',
                        color: timer.isRunning ? '#16a34a' : 'var(--text-dim)',
                        letterSpacing: '0.04em', width: 104, textAlign: 'center',
                        flexShrink: 0, transition: 'color 0.3s'
                    }}>
                        {displayTime}
                    </div>

                    {/* Start / Stop button */}
                    <div style={{ marginLeft: 12, flexShrink: 0 }}>
                        {timer.isRunning ? (
                            <button onClick={handleStop} disabled={loading}
                                style={{ width: 38, height: 38, borderRadius: '50%', background: '#dc2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(220,38,38,0.3)', transition: 'all 0.15s' }}>
                                <Square size={15} color="white" fill="white" />
                            </button>
                        ) : (
                            <button onClick={handleStart} disabled={!selection.projectId}
                                title={selection.projectId ? 'Start timer' : 'Select a project first'}
                                style={{ width: 38, height: 38, borderRadius: '50%', background: selection.projectId ? '#6366f1' : '#e5e7eb', border: 'none', cursor: selection.projectId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: selection.projectId ? '0 2px 8px rgba(99,102,241,0.35)' : 'none', transition: 'all 0.15s' }}>
                                <Play size={15} color={selection.projectId ? 'white' : '#9ca3af'} fill={selection.projectId ? 'white' : '#9ca3af'} style={{ marginLeft: 2 }} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Tab bar ───────────────────────────────────────────────────── */}
            <div style={{
                padding: '0 24px', flexShrink: 0,
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)'
            }}>
                <div style={{ display: 'flex', gap: 0 }}>
                    {([
                        { id: 'timesheet', label: 'Time Sheet', Icon: TableProperties },
                        { id: 'board', label: 'Pipeline Board', Icon: LayoutGrid },
                    ] as const).map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '12px 18px', border: 'none', background: 'transparent',
                                cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500,
                                color: activeTab === tab.id ? '#6366f1' : 'var(--text-muted)',
                                borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                                marginBottom: -1, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif'
                            }}>
                            <tab.Icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* New Project button — visible on both tabs */}
                <button className="btn btn-primary btn-sm" onClick={() => setShowQuickCreate(true)} style={{ marginRight: 4 }}>
                    <Plus size={13} /> New Project
                </button>
            </div>

            {/* ── Tab content ───────────────────────────────────────────────── */}
            {activeTab === 'timesheet' ? (
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 32px' }}>
                    {grouped.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                            <Clock size={40} style={{ margin: '0 auto 16px', opacity: 0.2, display: 'block', color: 'var(--text-dim)' }} />
                            <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-muted)', marginBottom: 8 }}>No time entries yet</p>
                            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Select a project above and press ▶ to start tracking.</p>
                        </div>
                    ) : (
                        grouped.map(group => (
                            <div key={group.key} style={{ marginBottom: 24 }}>
                                {/* Day header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Total: {formatHM(group.total)}</span>
                                </div>

                                {/* Entry card — NO overflow:hidden so menus are never clipped */}
                                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                    {group.entries.map((entry, idx) => {
                                        const proj = entry.project
                                        return (
                                            <div key={entry.id}
                                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: idx < group.entries.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: idx === 0 ? '12px 12px 0 0' : idx === group.entries.length - 1 ? '0 0 12px 12px' : 0, transition: 'background 0.1s' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                                                {/* Description */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {editingEntry?.id === entry.id ? (
                                                        <input
                                                            autoFocus
                                                            value={editingEntry.notes}
                                                            onChange={e => setEditingEntry({ id: entry.id, notes: e.target.value })}
                                                            onBlur={() => handleSaveEntryNotes(entry.id, editingEntry.notes)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleSaveEntryNotes(entry.id, editingEntry.notes)
                                                                if (e.key === 'Escape') setEditingEntry(null)
                                                            }}
                                                            style={{ width: '100%', border: 'none', outline: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--surface2)', fontSize: 16, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}
                                                        />
                                                    ) : (
                                                        <span
                                                            onClick={() => setEditingEntry({ id: entry.id, notes: entry.notes || '' })}
                                                            title="Click to edit"
                                                            style={{ fontSize: 16, color: entry.notes ? 'var(--text)' : 'var(--text-dim)', fontStyle: entry.notes ? 'normal' : 'italic', cursor: 'text', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {entry.notes || 'No description'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Event code badge */}
                                                {proj && (
                                                    <button onClick={() => proj.id && openProjectDetail(proj.id)} title="View project details"
                                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: 'none', background: proj.stage?.color ? `${proj.stage.color}18` : 'rgba(99,102,241,0.1)', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                                                        {proj.stage?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: proj.stage.color, flexShrink: 0, display: 'inline-block' }} />}
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: proj.stage?.color || '#6366f1', whiteSpace: 'nowrap' }}>{proj.event_code || proj.name}</span>
                                                    </button>
                                                )}

                                                {/* Time range */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                    <Calendar size={13} />
                                                    <span>{formatTime(entry.started_at)}{entry.ended_at ? ` – ${formatTime(entry.ended_at)}` : ' – running'}</span>
                                                </div>

                                                {/* Duration */}
                                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: '"Courier New", monospace', minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
                                                    {entry.duration_seconds ? formatHM(entry.duration_seconds) : '—'}
                                                </div>

                                                {/* Resume */}
                                                <button onClick={() => handleResume(entry)} disabled={timer.isRunning} title="Resume"
                                                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', cursor: timer.isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: timer.isRunning ? 0.3 : 1, flexShrink: 0, color: 'var(--text-muted)', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { if (!timer.isRunning) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                                    <Play size={10} fill="currentColor" />
                                                </button>

                                                {/* ⋯ menu trigger — fixed position to avoid clipping */}
                                                <button
                                                    onClick={e => {
                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                                        setMenuState(menuState?.id === entry.id ? null : { id: entry.id, x: rect.right, y: rect.bottom })
                                                    }}
                                                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                                    <MoreHorizontal size={13} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* Pipeline Board tab */
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <BoardClient
                        userId={userId}
                        initialStages={initialStages as unknown as Parameters<typeof BoardClient>[0]['initialStages']}
                        initialProjects={initialProjects as unknown as Parameters<typeof BoardClient>[0]['initialProjects']}
                        initialClients={initialClients}
                        embedded={true}
                    />
                </div>
            )}

            {/* Fixed-position entry action menu (never clipped by overflow) */}
            {menuState && (() => {
                const entry = timeEntries.find(e => e.id === menuState.id)
                if (!entry) return null
                return (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setMenuState(null)} />
                        <div style={{
                            position: 'fixed',
                            right: window.innerWidth - menuState.x,
                            top: menuState.y + 6,
                            zIndex: 9999,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            minWidth: 165,
                            overflow: 'hidden'
                        }}>
                            <button onClick={() => handleDuplicate(entry)}
                                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <Copy size={13} /> Duplicate entry
                            </button>
                            <div style={{ height: 1, background: 'var(--border)' }} />
                            <button onClick={() => handleDelete(entry.id)}
                                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.05)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <Trash2 size={13} /> Delete entry
                            </button>
                        </div>
                    </>
                )
            })()}

            {/* Quick Create */}
            {showQuickCreate && <QuickCreateModal onClose={() => setShowQuickCreate(false)} onCreate={handleQuickCreated} />}

            {/* Incomplete project guard */}
            {incompletePrompt && (
                <CompleteProjectModal project={incompletePrompt}
                    onClose={() => { setIncompletePrompt(null); setPendingStart(false) }}
                    onSkip={() => { setIncompletePrompt(null); setQuickCreatedIds(prev => { const n = new Set(prev); n.delete(incompletePrompt.id); return n }); if (pendingStart) doStart(); setPendingStart(false) }}
                    onComplete={() => { setIncompletePrompt(null); setPendingStart(false); openProjectDetail(incompletePrompt.id) }}
                />
            )}

            {/* Project Detail Panel */}
            {detailProject && fullDetailData && (
                <ProjectDetailPanel
                    project={fullDetailData as unknown as Parameters<typeof ProjectDetailPanel>[0]['project']}
                    userId={userId} stages={initialStages} clients={initialClients}
                    onClose={() => { setDetailProject(null); setFullDetailData(null) }}
                    onUpdated={async () => {
                        setDetailProject(null); setFullDetailData(null)
                        if (fullDetailData?.id) setQuickCreatedIds(prev => { const n = new Set(prev); n.delete(fullDetailData.id as string); return n })
                        await refreshEntries()
                        if (pendingStart) { doStart(); setPendingStart(false) }
                    }}
                />
            )}
        </div>
    )
}
