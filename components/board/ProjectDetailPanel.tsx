'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, isProjectOverdue, isTaskOverdue } from '@/lib/utils'
import { useTimer } from '@/context/TimerContext'
import { setProjectArchived, updateProjectDetails } from '@/app/(dashboard)/actions'
import {
    Info, CheckSquare, ListChecks, Clock, FileText,
    Archive, ArchiveRestore, CalendarDays, Pencil, type LucideIcon,
} from 'lucide-react'

interface Stage { id: string; name: string; color: string }
interface Task { id: string; name: string; description?: string; position: number; status: string; due_at?: string | null; due_has_time?: boolean }

const TASK_STATUSES = ['To Do', 'In Progress', 'Done'] as const
type TaskStatus = typeof TASK_STATUSES[number]

const TASK_STATUS_STYLE: Record<TaskStatus, { bg: string; color: string }> = {
    'To Do':       { bg: 'var(--surface2)',            color: 'var(--text-muted)' },
    'In Progress': { bg: 'rgba(79,70,229,0.12)',      color: 'var(--accent-light)' },
    'Done':        { bg: 'rgba(34,197,94,0.12)',       color: 'var(--success)' },
}

// Combine an optional date (yyyy-mm-dd) and time (HH:mm) into an ISO timestamp + a flag
// indicating whether a time-of-day was supplied. Returns null when no date is given.
function buildDueValue(date: string, time: string): { due_at: string | null; due_has_time: boolean } {
    if (!date) return { due_at: null, due_has_time: false }
    if (time) return { due_at: new Date(`${date}T${time}`).toISOString(), due_has_time: true }
    return { due_at: new Date(`${date}T00:00:00`).toISOString(), due_has_time: false }
}

function formatDue(due_at?: string | null, hasTime?: boolean): string {
    if (!due_at) return ''
    const d = new Date(due_at)
    const datePart = d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!hasTime) return datePart
    return `${datePart} · ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
}
interface NotesLog { id: string; content: string; created_at: string; user_id: string }
interface ChecklistItem { id: string; text: string; checked: boolean; checked_at?: string }
interface TimeEntry { id: string; started_at: string; ended_at?: string; duration_seconds?: number; notes?: string | null; tag?: string | null; task_id?: string }

interface Project {
    id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string
    build_type?: string; build_addons?: string[]; project_type?: string; stakeholder_name?: string; stakeholder_email?: string
    due_date?: string; build_live_date?: string; start_date?: string; build_assigned_date?: string
    web_build_start_date?: string; first_draft_sent_date?: string; kickoff_call_date?: string
    notes?: string; stage_id?: string; archived?: boolean
    stage?: { id: string; name: string; color: string }
}

interface ProjectDetailPanelProps {
    project: Project
    userId: string
    stages: Stage[]
    clients: { id: string; name: string }[]
    onClose: () => void
    onUpdated: () => void
    onArchived?: () => void
    initialTab?: TabId
}

const TIME_TAGS = [
    'Custom Task - Client',
    'Edits/Updates',
    'General Enquiries',
    'Review Calls',
    'Mobile App Setup',
    'Product - Customer Support',
    'Registration Website Setup',
    'Self QC',
    'Attendee Management',
]

const PRIMARY_BUILD_TYPES = [
    'Registration Website',
    'Website + Attendee Hub',
    'Attendee hub + Event App',
    'Website + Event App',
    'Website + Attendee hub + Event App',
]
const BUILD_ADDONS = ['Stand alone Survey', 'On Arrival', 'Exhibitor Management']
const PROJECT_TYPES = ['In person Event', 'Virtual Event', 'Hybrid Event']

type TabId = 'overview' | 'tasks' | 'checklist' | 'timelog' | 'notes'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'checklist', label: 'Checklist', icon: ListChecks },
    { id: 'timelog', label: 'Time Log', icon: Clock },
    { id: 'notes', label: 'Notes', icon: FileText },
]

export default function ProjectDetailPanel({ project, userId, stages, clients, onClose, onUpdated, onArchived, initialTab }: ProjectDetailPanelProps) {
    const supabase = createClient()
    const { startTimer, stopTimer, activeTimer, displayTime, timerNotes: ctxTimerNotes, timerTag: ctxTimerTag, setTimerNotes, setTimerTag } = useTimer()
    const isTimerForThisProject = activeTimer?.projectId === project.id
    const [tab, setTab] = useState<TabId>(initialTab ?? 'overview')
    const [timerDescription, setTimerDescription] = useState(isTimerForThisProject ? ctxTimerNotes : '')
    const [selectedTag, setSelectedTag] = useState(isTimerForThisProject ? ctxTimerTag : '')
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
    const [editingNotes, setEditingNotes] = useState('')
    const [tasks, setTasks] = useState<Task[]>([])
    const [checklist, setChecklist] = useState<ChecklistItem[]>([])
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [notesLog, setNotesLog] = useState<NotesLog[]>([])
    const [newNote, setNewNote] = useState('')
    const [loading, setLoading] = useState(false)
    const [newTaskName, setNewTaskName] = useState('')
    const [newTaskDate, setNewTaskDate] = useState('')
    const [newTaskTime, setNewTaskTime] = useState('')
    const [taskFilter, setTaskFilter] = useState<'All' | TaskStatus>('All')
    const [newCheckItem, setNewCheckItem] = useState('')
    // Notes → task composer
    const [noteIsTask, setNoteIsTask] = useState(false)
    const [noteTaskDate, setNoteTaskDate] = useState('')
    const [noteTaskTime, setNoteTaskTime] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        name: project.name,
        event_code: project.event_code ?? '',
        stage_id: project.stage_id ?? '',
        build_type: project.build_type ?? '',
        build_addons: project.build_addons ?? [] as string[],
        project_type: project.project_type ?? '',
        start_date: project.start_date ?? '',
        kickoff_call_date: project.kickoff_call_date ?? '',
        web_build_start_date: project.web_build_start_date ?? '',
        first_draft_sent_date: project.first_draft_sent_date ?? '',
        due_date: project.due_date ?? '',
        stakeholder_name: project.stakeholder_name ?? '',
        stakeholder_email: project.stakeholder_email ?? '',
        client_id: project.client_id ?? '',
    })

    function toggleEditAddon(addon: string) {
        setEditForm(f => ({
            ...f,
            build_addons: f.build_addons.includes(addon)
                ? f.build_addons.filter(a => a !== addon)
                : [...f.build_addons, addon]
        }))
    }

    async function saveEdit() {
        setLoading(true)
        const { error } = await updateProjectDetails(project.id, {
            name:                 editForm.name || null,
            event_code:           editForm.event_code || null,
            stage_id:             editForm.stage_id || null,
            build_type:           editForm.build_type || null,
            build_addons:         editForm.build_addons.length > 0 ? editForm.build_addons : null,
            project_type:         editForm.project_type || null,
            start_date:           editForm.start_date || null,
            build_assigned_date:  editForm.start_date || null,
            kickoff_call_date:    editForm.kickoff_call_date || null,
            web_build_start_date: editForm.web_build_start_date || null,
            first_draft_sent_date:editForm.first_draft_sent_date || null,
            due_date:             editForm.due_date || null,
            build_live_date:      editForm.due_date || null,
            stakeholder_name:     editForm.stakeholder_name || null,
            stakeholder_email:    editForm.stakeholder_email || null,
            client_id:            editForm.client_id || null,
        })
        setLoading(false)
        if (!error) { setIsEditing(false); onUpdated() }
    }

    useEffect(() => {
        const load = async () => {
            const [{ data: t }, { data: c }, { data: te }, { data: nl }] = await Promise.all([
                supabase.from('tasks').select('*').eq('project_id', project.id).order('position'),
                supabase.from('checklist_items').select('*').eq('project_id', project.id).order('position'),
                supabase.from('time_entries').select('*').eq('project_id', project.id).order('started_at', { ascending: false }),
                supabase.from('project_notes_log').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
            ])
            
            setTasks(t ?? [])
            setChecklist(c ?? [])
            setTimeEntries(te ?? [])
            setNotesLog(nl ?? [])
        }
        load()
    }, [project.id, supabase, userId])

    const refreshTimeEntries = async () => {
        const { data } = await supabase.from('time_entries').select('*').eq('project_id', project.id).order('started_at', { ascending: false })
        if (data) setTimeEntries(data)
    }

    const handleTimerStop = async () => {
        await stopTimer(timerDescription || undefined, selectedTag || undefined)
        setTimerDescription('')
        setSelectedTag('')
        await refreshTimeEntries()
    }

    const saveEntryNotes = async (entryId: string, notes: string) => {
        await supabase.from('time_entries').update({ notes: notes || null }).eq('id', entryId)
        setTimeEntries(prev => prev.map(e => e.id === entryId ? { ...e, notes: notes || null } : e))
        setEditingEntryId(null)
    }

    const saveEntryTag = async (entryId: string, tag: string) => {
        await supabase.from('time_entries').update({ tag: tag || null }).eq('id', entryId)
        setTimeEntries(prev => prev.map(e => e.id === entryId ? { ...e, tag: tag || null } : e))
    }

    // Tasks (action items)
    const addTask = async () => {
        if (!newTaskName.trim()) return
        const { due_at, due_has_time } = buildDueValue(newTaskDate, newTaskTime)
        const { data } = await supabase.from('tasks').insert({
            project_id: project.id, user_id: userId, name: newTaskName.trim(),
            status: 'To Do', position: tasks.length, due_at, due_has_time,
        }).select().single()
        if (data) setTasks(prev => [...prev, data])
        setNewTaskName('')
        setNewTaskDate('')
        setNewTaskTime('')
    }

    const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
        await supabase.from('tasks').update({ status }).eq('id', taskId)
    }

    const deleteTask = async (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        await supabase.from('tasks').delete().eq('id', taskId)
    }

    // Checklist
    const toggleCheck = async (itemId: string, checked: boolean) => {
        const now = new Date().toISOString()
        setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, checked, checked_at: checked ? now : undefined } : c))
        await supabase.rpc('toggle_checklist_item', {
            p_id: itemId,
            p_checked: checked,
            p_checked_at: checked ? now : null,
        })
    }

    const addCheckItem = async () => {
        if (!newCheckItem.trim()) return
        const { data } = await supabase.from('checklist_items').insert({
            project_id: project.id, user_id: userId, text: newCheckItem.trim(), position: checklist.length
        }).select().single()
        if (data) setChecklist(prev => [...prev, data])
        setNewCheckItem('')
    }

    // Notes Log
    const addNote = async () => {
        if (!newNote.trim()) return
        setLoading(true)
        const content = newNote.trim()

        // When flagged as a task, also create an action item in the Tasks tab.
        if (noteIsTask) {
            const { due_at, due_has_time } = buildDueValue(noteTaskDate, noteTaskTime)
            const { data: task } = await supabase.from('tasks').insert({
                project_id: project.id, user_id: userId, name: content,
                status: 'To Do', position: tasks.length, due_at, due_has_time,
            }).select().single()
            if (task) setTasks(prev => [...prev, task])
        }

        const { data } = await supabase.from('project_notes_log').insert({
            project_id: project.id,
            user_id: userId,
            content
        }).select().single()

        if (data) {
            setNotesLog(prev => [data, ...prev])
            setNewNote('')
            setNoteIsTask(false)
            setNoteTaskDate('')
            setNoteTaskTime('')
        }
        setLoading(false)
    }

    const archiveProject = async () => {
        if (!confirm(`Archive "${project.name}"?\n\nThis will hide the project from the board. You can restore it any time from the Archived view.`)) return
        const { error } = await setProjectArchived(project.id, true)
        if (error) {
            alert(`Archive failed: ${error}`)
            return
        }
        if (onArchived) onArchived()
        else onUpdated()
    }

    const restoreProject = async () => {
        const { error } = await setProjectArchived(project.id, false)
        if (error) {
            alert(`Restore failed: ${error}`)
            return
        }
        onUpdated()
    }

    const checklistDone = checklist.filter(c => c.checked).length
    const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(16,24,40,0.5)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end'
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="slide-in" style={{
                width: '100%', maxWidth: 860, height: '100vh',
                background: 'var(--surface)', borderLeft: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '22px 28px', borderBottom: '1px solid var(--border)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* 1. Event Name — primary, largest */}
                            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 4 }}>
                                {project.name}
                            </h2>

                            {/* 2. Event Code — secondary, below name */}
                            {project.event_code && (
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
                                    {project.event_code}
                                </div>
                            )}

                            {/* 3. Tags — lowest hierarchy, below both */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {project.stage && (
                                    <span style={{
                                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
                                        background: `${project.stage.color}18`, color: project.stage.color
                                    }}>{project.stage.name}</span>
                                )}
                                {project.client?.name && (
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                                        background: `${project.client_color ?? '#4f46e5'}20`,
                                        color: project.client_color ?? '#4f46e5'
                                    }}>{project.client.name}</span>
                                )}
                                {project.build_type && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(79,70,229,0.12)', color: 'var(--accent-light)' }}>{project.build_type}</span>
                                )}
                                {(project.build_addons ?? []).map(a => (
                                    <span key={a} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>+{a}</span>
                                ))}
                                {project.project_type && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>{project.project_type}</span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                            {project.archived ? (
                                <button
                                    onClick={restoreProject}
                                    title="Restore to board"
                                    style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)',
                                        background: 'var(--accent-dim)', color: 'var(--accent)',
                                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'inline-flex', alignItems: 'center', gap: 6
                                    }}
                                ><ArchiveRestore size={13} /> Restore to Board</button>
                            ) : (
                                <button
                                    className="btn-icon"
                                    title="Archive project — hides it from the board"
                                    onClick={archiveProject}
                                ><Archive size={15} /></button>
                            )}
                            <button className="btn-icon" onClick={onClose} aria-label="Close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
                            <Clock size={12} /> <strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{formatDuration(totalSeconds)}</strong> logged
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
                            <ListChecks size={12} /> <strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{checklistDone}/{checklist.length}</strong> checks
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
                            <CheckSquare size={12} /> <strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{tasks.filter(t => t.status !== 'Done').length}</strong> open
                        </span>
                        {project.due_date && (() => {
                            const dueOverdue = isProjectOverdue(project.due_date, project.stage?.name)
                            return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: dueOverdue ? 'var(--danger)' : 'var(--text-dim)', fontWeight: dueOverdue ? 600 : 400 }}>
                                    <CalendarDays size={12} /> {new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {dueOverdue && ' · overdue'}
                                </span>
                            )
                        })()}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 28px' }}>
                    {TABS.map(t => {
                        const TabIcon = t.icon
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                style={{
                                    padding: '12px 14px', fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
                                    color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                                    transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 6
                                }}
                            >
                                <TabIcon size={14} />{t.label}
                            </button>
                        )
                    })}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>

                    {/* OVERVIEW */}
                    {tab === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Edit / Save bar */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                {isEditing ? (
                                    <>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={loading}>
                                            {loading ? <span className="spinner" /> : 'Save changes'}
                                        </button>
                                    </>
                                ) : (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}><Pencil size={12} /> Edit</button>
                                )}
                            </div>

                            {isEditing ? (
                                /* ── EDIT MODE ── */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Project Name</label>
                                            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="label">Event Code</label>
                                            <input className="input" value={editForm.event_code} onChange={e => setEditForm(f => ({ ...f, event_code: e.target.value }))} placeholder="e.g. EVT-2026-001" />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Stage</label>
                                            <select className="input" value={editForm.stage_id} onChange={e => setEditForm(f => ({ ...f, stage_id: e.target.value }))}>
                                                <option value="">— None —</option>
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Type of Project</label>
                                            <select className="input" value={editForm.project_type} onChange={e => setEditForm(f => ({ ...f, project_type: e.target.value }))}>
                                                <option value="">— None —</option>
                                                {PROJECT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label">Type of Build</label>
                                        <select className="input" value={editForm.build_type} onChange={e => setEditForm(f => ({ ...f, build_type: e.target.value }))}>
                                            <option value="">— None —</option>
                                            {PRIMARY_BUILD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="label">Add-ons <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>(select any)</span></label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                            {BUILD_ADDONS.map(addon => (
                                                <label key={addon} style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                                    padding: '8px 12px', borderRadius: 8,
                                                    background: editForm.build_addons.includes(addon) ? 'var(--accent-dim)' : 'var(--surface2)',
                                                    border: `1px solid ${editForm.build_addons.includes(addon) ? 'rgba(79,70,229,0.4)' : 'var(--border)'}`,
                                                    transition: 'all 0.15s'
                                                }}>
                                                    <div style={{
                                                        width: 16, height: 16, borderRadius: 4, border: '2px solid',
                                                        borderColor: editForm.build_addons.includes(addon) ? 'var(--accent)' : 'var(--border)',
                                                        background: editForm.build_addons.includes(addon) ? 'var(--accent)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                    }}>
                                                        {editForm.build_addons.includes(addon) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                                                    </div>
                                                    <input type="checkbox" checked={editForm.build_addons.includes(addon)} onChange={() => toggleEditAddon(addon)} style={{ display: 'none' }} />
                                                    <span style={{ fontSize: 13, color: editForm.build_addons.includes(addon) ? 'var(--accent-light)' : 'var(--text)' }}>{addon}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Build Assigned Date</label>
                                            <input className="input" type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="label">Kick-off Call Date</label>
                                            <input className="input" type="date" value={editForm.kickoff_call_date} onChange={e => setEditForm(f => ({ ...f, kickoff_call_date: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Web Build Start Date</label>
                                            <input className="input" type="date" value={editForm.web_build_start_date} onChange={e => setEditForm(f => ({ ...f, web_build_start_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="label">First Draft Sent Date</label>
                                            <input className="input" type="date" value={editForm.first_draft_sent_date} onChange={e => setEditForm(f => ({ ...f, first_draft_sent_date: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Build Live Date</label>
                                            <input className="input" type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                                        </div>
                                        <div /> {/* spacer */}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">Stakeholder Name</label>
                                            <input className="input" value={editForm.stakeholder_name} onChange={e => setEditForm(f => ({ ...f, stakeholder_name: e.target.value }))} placeholder="e.g. Jane Smith" />
                                        </div>
                                        <div>
                                            <label className="label">Stakeholder Email</label>
                                            <input className="input" type="email" value={editForm.stakeholder_email} onChange={e => setEditForm(f => ({ ...f, stakeholder_email: e.target.value }))} placeholder="jane@company.com" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label">Client</label>
                                        <select className="input" value={editForm.client_id} onChange={e => setEditForm(f => ({ ...f, client_id: e.target.value }))}>
                                            <option value="">— None —</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                /* ── VIEW MODE ── */
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    {[
                                        { l: 'Event Code', v: project.event_code || '—' },
                                        {
                                            l: 'Stage', v: project.stage ? (
                                                <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: `${project.stage.color}18`, color: project.stage.color }}>{project.stage.name}</span>
                                            ) : '—'
                                        },
                                        {
                                            l: 'Type of Build', v: project.build_type ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(79,70,229,0.1)', color: 'var(--accent-light)', display: 'inline-block' }}>{project.build_type}</span>
                                                    {(project.build_addons ?? []).map(a => (
                                                        <span key={a} style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', display: 'inline-block' }}>+ {a}</span>
                                                    ))}
                                                </div>
                                            ) : '—'
                                        },
                                        { l: 'Type of Project', v: project.project_type ? <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>{project.project_type}</span> : '—' },
                                        { l: 'Build Assigned Date', v: project.start_date ? new Date(project.start_date).toLocaleDateString() : '—' },
                                        { l: 'Kick-off Call Date', v: project.kickoff_call_date ? new Date(project.kickoff_call_date).toLocaleDateString() : '—' },
                                        { l: 'Web Build Start Date', v: project.web_build_start_date ? new Date(project.web_build_start_date).toLocaleDateString() : '—' },
                                        { l: 'First Draft Sent Date', v: project.first_draft_sent_date ? new Date(project.first_draft_sent_date).toLocaleDateString() : '—' },
                                        {
                                            l: 'Build Live Date', v: (project.due_date || project.build_live_date) ? (
                                                <span style={{ color: isProjectOverdue(project.due_date, project.stage?.name) ? 'var(--danger)' : 'var(--text)' }}>
                                                    {new Date(project.due_date ?? project.build_live_date!).toLocaleDateString()}{isProjectOverdue(project.due_date, project.stage?.name) ? ' · overdue' : ''}
                                                </span>
                                            ) : '—'
                                        },
                                        {
                                            l: 'Build Stakeholder',
                                            v: project.stakeholder_name ? (
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{project.stakeholder_name}</div>
                                                    {project.stakeholder_email && (
                                                        <a href={`mailto:${project.stakeholder_email}`} style={{ fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none' }}>
                                                            {project.stakeholder_email}
                                                        </a>
                                                    )}
                                                </div>
                                            ) : '—'
                                        },
                                        { l: 'Client', v: project.client?.name || '—' },
                                        { l: 'Total time logged', v: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatDuration(totalSeconds)}</span> },
                                    ].map(row => (
                                        <div key={row.l} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                            <div className="label" style={{ marginBottom: 4 }}>{row.l}</div>
                                            <div style={{ fontSize: 14, color: 'var(--text)' }}>{row.v}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TASKS — action items (no timer) */}
                    {tab === 'tasks' && (() => {
                        // Open items first (by due date, undated last), Done collapsed to the bottom.
                        const rank = (t: Task) => t.status === 'Done' ? 1 : 0
                        const dueKey = (t: Task) => t.due_at ? new Date(t.due_at).getTime() : Infinity
                        const visible = tasks
                            .filter(t => taskFilter === 'All' || t.status === taskFilter)
                            .slice()
                            .sort((a, b) => rank(a) - rank(b) || dueKey(a) - dueKey(b) || a.position - b.position)
                        const openCount = tasks.filter(t => t.status !== 'Done').length

                        return (
                        <div>
                            {/* Add action item */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                <input
                                    className="input"
                                    placeholder="Add an action item…"
                                    value={newTaskName}
                                    onChange={e => setNewTaskName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addTask()}
                                    style={{ flex: '1 1 200px', minWidth: 160 }}
                                />
                                <input
                                    className="input"
                                    type="date"
                                    value={newTaskDate}
                                    onChange={e => setNewTaskDate(e.target.value)}
                                    title="Due date (optional)"
                                    style={{ flex: '0 0 auto', width: 150 }}
                                />
                                <input
                                    className="input"
                                    type="time"
                                    value={newTaskTime}
                                    onChange={e => setNewTaskTime(e.target.value)}
                                    disabled={!newTaskDate}
                                    title={newTaskDate ? 'Due time (optional)' : 'Set a date first'}
                                    style={{ flex: '0 0 auto', width: 120, opacity: newTaskDate ? 1 : 0.5 }}
                                />
                                <button className="btn btn-primary btn-sm" onClick={addTask} style={{ flexShrink: 0 }}>Add</button>
                            </div>

                            {/* Status filter */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                                {(['All', ...TASK_STATUSES] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setTaskFilter(f)}
                                        style={{
                                            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                            cursor: 'pointer', fontFamily: 'inherit',
                                            border: `1px solid ${taskFilter === f ? 'var(--accent)' : 'var(--border)'}`,
                                            background: taskFilter === f ? 'var(--accent-dim)' : 'transparent',
                                            color: taskFilter === f ? 'var(--accent-light)' : 'var(--text-muted)',
                                        }}
                                    >{f}{f === 'All' ? ` · ${openCount} open` : ''}</button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {visible.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                                        <p style={{ fontSize: 14 }}>
                                            {tasks.length === 0
                                                ? 'No action items yet. Add one above, or flag a note as a task in the Notes tab.'
                                                : 'No action items match this filter.'}
                                        </p>
                                    </div>
                                )}
                                {visible.map(task => {
                                    const done = task.status === 'Done'
                                    const overdue = !done && isTaskOverdue(task.due_at, task.due_has_time)
                                    const style = TASK_STATUS_STYLE[(task.status as TaskStatus)] ?? TASK_STATUS_STYLE['To Do']
                                    return (
                                        <div key={task.id} style={{
                                            display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12,
                                            padding: '10px 14px', background: 'var(--surface2)',
                                            border: `1px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                                            borderRadius: 10, transition: 'all 0.2s', opacity: done ? 0.65 : 1,
                                        }}>
                                            {/* Status control */}
                                            <select
                                                value={task.status}
                                                onChange={e => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                                                title="Change status"
                                                style={{
                                                    fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                                    background: style.bg, color: style.color, flexShrink: 0,
                                                }}
                                            >
                                                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>

                                            {/* Name + due */}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 14, fontWeight: 600, color: 'var(--text)',
                                                    textDecoration: done ? 'line-through' : 'none',
                                                }}>{task.name}</div>
                                                {task.due_at && (
                                                    <div style={{
                                                        fontSize: 11, marginTop: 2, fontWeight: 600,
                                                        color: overdue ? 'var(--danger)' : 'var(--text-dim)',
                                                    }}>
                                                        <CalendarDays size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />{formatDue(task.due_at, task.due_has_time)}{overdue ? ' · overdue' : ''}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                className="btn-icon btn-sm"
                                                style={{ color: 'var(--text-dim)', flexShrink: 0 }}
                                                title="Delete action item"
                                                onClick={() => deleteTask(task.id)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        )
                    })()}

                    {/* CHECKLIST */}
                    {tab === 'checklist' && (
                        <div>
                            {checklist.length > 0 && (
                                <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>Project Compliance</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: checklistDone === checklist.length ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {Math.round((checklistDone / checklist.length) * 100)}%
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 3,
                                            background: checklistDone === checklist.length ? 'var(--success)' : 'var(--accent)',
                                            width: `${checklist.length > 0 ? (checklistDone / checklist.length) * 100 : 0}%`,
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <input
                                    className="input"
                                    placeholder="Add custom project task..."
                                    value={newCheckItem}
                                    onChange={e => setNewCheckItem(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                                />
                                <button className="btn btn-primary btn-sm" onClick={addCheckItem} style={{ flexShrink: 0 }}>Add</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {checklist.map(item => (
                                    <label key={item.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                                        padding: '12px 14px', borderRadius: 10,
                                        background: item.checked ? 'rgba(34,197,94,0.06)' : 'var(--surface2)',
                                        border: `1px solid ${item.checked ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <div style={{
                                            width: 18, height: 18, borderRadius: 4, border: '2px solid',
                                            borderColor: item.checked ? 'var(--success)' : 'var(--border)',
                                            background: item.checked ? 'var(--success)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
                                            transition: 'all 0.15s'
                                        }}>
                                            {item.checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={e => toggleCheck(item.id, e.target.checked)}
                                                style={{ opacity: 0, position: 'absolute', cursor: 'pointer' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <span style={{
                                                fontSize: 14, fontWeight: 500, lineHeight: 1.5,
                                                color: item.checked ? 'var(--text-dim)' : 'var(--text)',
                                                textDecoration: item.checked ? 'line-through' : 'none'
                                            }}>{item.text}</span>
                                            {item.checked && item.checked_at && (
                                                <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2, fontWeight: 700 }}>
                                                    Completed on {new Date(item.checked_at).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TIME LOG */}
                    {tab === 'timelog' && (
                        <div>
                            {/* ── Timer control card ── */}
                            <div style={{
                                marginBottom: 20, borderRadius: 12, overflow: 'hidden',
                                border: activeTimer?.projectId === project.id
                                    ? '1px solid rgba(22,163,74,0.35)'
                                    : '1px solid var(--border)',
                                background: activeTimer?.projectId === project.id
                                    ? 'rgba(22,163,74,0.06)'
                                    : 'var(--surface2)',
                            }}>
                                {/* Status row */}
                                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                                    {activeTimer?.projectId === project.id && (
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                                    )}
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: activeTimer?.projectId === project.id ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {activeTimer?.projectId === project.id ? 'Recording' : 'Start a session'}
                                    </span>
                                    {activeTimer?.projectId === project.id && (
                                        <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--success)', letterSpacing: '0.02em' }}>
                                            {displayTime}
                                        </span>
                                    )}
                                    {activeTimer && activeTimer.projectId !== project.id && (
                                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>Will stop current timer</span>
                                    )}
                                </div>

                                {/* Description — always editable */}
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                                    <input
                                        value={timerDescription}
                                        onChange={e => {
                                            const val = e.target.value
                                            setTimerDescription(val)
                                            if (!activeTimer || isTimerForThisProject) setTimerNotes(val)
                                        }}
                                        placeholder="Describe what you're working on… (optional)"
                                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }}
                                    />
                                </div>

                                {/* Tag selector — single select dropdown */}
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                                    <select
                                        value={selectedTag}
                                        onChange={e => {
                                            const val = e.target.value
                                            setSelectedTag(val)
                                            if (!activeTimer || isTimerForThisProject) setTimerTag(val)
                                        }}
                                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: selectedTag ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'inherit', cursor: 'pointer' }}
                                    >
                                        <option value="">Select a tag… (optional)</option>
                                        {TIME_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                    </select>
                                </div>

                                {/* Start / Stop button */}
                                <div style={{ padding: '10px 14px' }}>
                                    {activeTimer?.projectId === project.id ? (
                                        <button onClick={handleTimerStop} style={{
                                            width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: 'var(--danger)', color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: 'var(--shadow-xs)',
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                                            Stop &amp; Save
                                        </button>
                                    ) : (
                                        <button onClick={() => startTimer({ projectId: project.id, projectName: project.name, taskName: timerDescription || undefined, mode: 'project' })} style={{
                                            width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: 'var(--shadow-xs)',
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                                            Start Timer
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Stats ── */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                                <div style={{ flex: 1, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-light)' }}>{formatDuration(totalSeconds)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total logged</div>
                                </div>
                                <div style={{ flex: 1, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{timeEntries.length}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sessions</div>
                                </div>
                            </div>

                            {/* ── Entry list ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {timeEntries.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                                        <p>No time logged yet. Start a session above.</p>
                                    </div>
                                )}
                                {timeEntries.map(entry => {
                                    const task = tasks.find(t => t.id === entry.task_id)
                                    const isEditingThis = editingEntryId === entry.id
                                    return (
                                        <div key={entry.id} style={{
                                            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden'
                                        }}>
                                            {/* Main row */}
                                            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                                                        {new Date(entry.started_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        {' · '}
                                                        {new Date(entry.started_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                                        {task && <span style={{ marginLeft: 6, color: 'var(--accent-light)' }}>· {task.name}</span>}
                                                    </div>

                                                    {/* Editable description */}
                                                    {isEditingThis ? (
                                                        <input
                                                            autoFocus
                                                            value={editingNotes}
                                                            onChange={e => setEditingNotes(e.target.value)}
                                                            onBlur={() => saveEntryNotes(entry.id, editingNotes)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') saveEntryNotes(entry.id, editingNotes)
                                                                if (e.key === 'Escape') setEditingEntryId(null)
                                                            }}
                                                            style={{ width: '100%', border: 'none', outline: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }}
                                                        />
                                                    ) : (
                                                        <div
                                                            onClick={() => { setEditingEntryId(entry.id); setEditingNotes(entry.notes ?? '') }}
                                                            title="Click to edit description"
                                                            style={{ fontSize: 14, color: entry.notes ? 'var(--text)' : 'var(--text-dim)', fontStyle: entry.notes ? 'normal' : 'italic', cursor: 'text', fontWeight: entry.notes ? 600 : 400 }}
                                                        >
                                                            {entry.notes || 'Add description…'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                                                    {entry.duration_seconds ? formatDuration(entry.duration_seconds) : '—'}
                                                </div>
                                            </div>

                                            {/* Tag row — single dropdown */}
                                            <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {entry.tag ? (
                                                    <span style={{
                                                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                                        background: 'rgba(79,70,229,0.12)', color: 'var(--accent-light)',
                                                        border: '1px solid rgba(79,70,229,0.2)', flexShrink: 0
                                                    }}>{entry.tag}</span>
                                                ) : null}
                                                <select
                                                    value={entry.tag ?? ''}
                                                    onChange={e => saveEntryTag(entry.id, e.target.value)}
                                                    style={{
                                                        flex: 1, border: 'none', outline: 'none', background: 'transparent',
                                                        fontSize: 11, color: 'var(--text-dim)', fontFamily: 'inherit', cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">{entry.tag ? 'Change tag…' : 'Add a tag…'}</option>
                                                    {TIME_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* NOTES */}
                    {tab === 'notes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <textarea
                                        className="input"
                                        value={newNote}
                                        onChange={e => setNewNote(e.target.value)}
                                        placeholder="Type a new update or log entry..."
                                        style={{ minHeight: 100, flex: 1, fontFamily: 'inherit', fontSize: 14 }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={addNote}
                                        disabled={loading || !newNote.trim()}
                                        style={{ alignSelf: 'flex-end' }}
                                    >
                                        {noteIsTask ? 'Add Task + Log' : 'Post Log'}
                                    </button>
                                </div>

                                {/* Flag this note as a task */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                                        <input
                                            type="checkbox"
                                            checked={noteIsTask}
                                            onChange={e => setNoteIsTask(e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        Make this a task
                                    </label>
                                    {noteIsTask && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <input
                                                className="input"
                                                type="date"
                                                value={noteTaskDate}
                                                onChange={e => setNoteTaskDate(e.target.value)}
                                                title="Due date (optional)"
                                                style={{ width: 150 }}
                                            />
                                            <input
                                                className="input"
                                                type="time"
                                                value={noteTaskTime}
                                                onChange={e => setNoteTaskTime(e.target.value)}
                                                disabled={!noteTaskDate}
                                                title={noteTaskDate ? 'Due time (optional)' : 'Set a date first'}
                                                style={{ width: 120, opacity: noteTaskDate ? 1 : 0.5 }}
                                            />
                                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                                                No date? Just an open task.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {notesLog.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 14 }}>
                                        No notes logged yet.
                                    </div>
                                )}
                                {notesLog.map(note => (
                                    <div key={note.id} style={{
                                        padding: '16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase' }}>Update</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                                                {new Date(note.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                                            {note.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
