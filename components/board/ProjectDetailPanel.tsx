'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, isOverdue } from '@/lib/utils'
import { useTimer } from '@/context/TimerContext'

interface Stage { id: string; name: string; color: string }
interface Task { id: string; name: string; description?: string; position: number }
interface NotesLog { id: string; content: string; created_at: string; user_id: string }
interface ChecklistItem { id: string; text: string; checked: boolean; checked_at?: string }
interface TimeEntry { id: string; started_at: string; ended_at?: string; duration_seconds?: number; notes?: string; task_id?: string }

interface Project {
    id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string
    build_type?: string; build_addons?: string[]; project_type?: string; stakeholder_name?: string; stakeholder_email?: string
    due_date?: string; build_live_date?: string; start_date?: string; build_assigned_date?: string
    web_build_start_date?: string; first_draft_sent_date?: string
    notes?: string; stage_id?: string
    stage?: { id: string; name: string; color: string }
}

interface ProjectDetailPanelProps {
    project: Project
    userId: string
    stages: Stage[]
    clients: { id: string; name: string }[]
    onClose: () => void
    onUpdated: () => void
}

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

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'tasks', label: 'Tasks', icon: '✓' },
    { id: 'checklist', label: 'Checklist', icon: '☑' },
    { id: 'timelog', label: 'Time Log', icon: '⏱' },
    { id: 'notes', label: 'Notes', icon: '📝' },
]

export default function ProjectDetailPanel({ project, userId, stages, clients, onClose, onUpdated }: ProjectDetailPanelProps) {
    const supabase = createClient()
    const { startTimer, stopTimer, activeTimer } = useTimer()
    const [tab, setTab] = useState<TabId>('overview')
    const [tasks, setTasks] = useState<Task[]>([])
    const [checklist, setChecklist] = useState<ChecklistItem[]>([])
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [notesLog, setNotesLog] = useState<NotesLog[]>([])
    const [newNote, setNewNote] = useState('')
    const [loading, setLoading] = useState(false)
    const [newTaskName, setNewTaskName] = useState('')
    const [newCheckItem, setNewCheckItem] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        name: project.name,
        event_code: project.event_code ?? '',
        stage_id: project.stage_id ?? '',
        build_type: project.build_type ?? '',
        build_addons: project.build_addons ?? [] as string[],
        project_type: project.project_type ?? '',
        start_date: project.start_date ?? '',
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
        const { error } = await supabase.rpc('update_project', {
            p_id:                   project.id,
            p_name:                 editForm.name || null,
            p_event_code:           editForm.event_code || null,
            p_stage_id:             editForm.stage_id || null,
            p_build_type:           editForm.build_type || null,
            p_build_addons:         editForm.build_addons.length > 0 ? editForm.build_addons : null,
            p_project_type:         editForm.project_type || null,
            p_start_date:           editForm.start_date || null,
            p_build_assigned_date:  editForm.start_date || null,
            p_web_build_start_date: editForm.web_build_start_date || null,
            p_first_draft_sent_date:editForm.first_draft_sent_date || null,
            p_due_date:             editForm.due_date || null,
            p_build_live_date:      editForm.due_date || null,
            p_stakeholder_name:     editForm.stakeholder_name || null,
            p_stakeholder_email:    editForm.stakeholder_email || null,
            p_client_id:            editForm.client_id || null,
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
            
            let finalTasks = t ?? []
            if (finalTasks.length === 0) {
                // If no tasks, load from checklist_templates as default tasks
                const { data: templates } = await supabase.from('checklist_templates').select('text').eq('user_id', userId).order('position')
                if (templates && templates.length > 0) {
                    const { data: createdTasks } = await supabase.from('tasks').insert(
                        templates.map((tmpl, i) => ({
                            project_id: project.id,
                            user_id: userId,
                            name: tmpl.text,
                            position: i
                        }))
                    ).select()
                    if (createdTasks) finalTasks = createdTasks
                }
            }

            setTasks(finalTasks)
            setChecklist(c ?? [])
            setTimeEntries(te ?? [])
            setNotesLog(nl ?? [])
        }
        load()
    }, [project.id, supabase, userId])

    // Tasks
    const addTask = async () => {
        if (!newTaskName.trim()) return
        const { data } = await supabase.from('tasks').insert({
            project_id: project.id, user_id: userId, name: newTaskName.trim(), position: tasks.length
        }).select().single()
        if (data) setTasks(prev => [...prev, data])
        setNewTaskName('')
    }

    const updateTaskStatus = async (taskId: string, status: any) => {
        // No-op or keep for internal state if needed, but UI checkmark is gone
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
        const { data, error } = await supabase.from('project_notes_log').insert({
            project_id: project.id,
            user_id: userId,
            content: newNote.trim()
        }).select().single()
        
        if (data) {
            setNotesLog(prev => [data, ...prev])
            setNewNote('')
        }
        setLoading(false)
    }

    // Archive project
    const archiveProject = async () => {
        if (!confirm(`Archive "${project.name}"?\n\nArchived projects are hidden from the Pipeline Board. You can view them by enabling "Show Archived" on the board.`)) return
        await supabase.from('projects').update({ archived: true }).eq('id', project.id)
        onUpdated()
    }

    const checklistDone = checklist.filter(c => c.checked).length
    const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)

    const formatEntryTime = (seconds?: number) => {
        if (!seconds) return '—'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end'
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="slide-in" style={{
                width: '100%', maxWidth: 860, height: '100vh',
                background: 'var(--surface)', borderLeft: '1px solid var(--border)',
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
                            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 4 }}>
                                {project.name}
                            </h2>

                            {/* 2. Event Code — secondary, below name */}
                            {project.event_code && (
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.04em', marginBottom: 10 }}>
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
                                        background: `${project.client_color ?? '#6366f1'}20`,
                                        color: project.client_color ?? '#6366f1'
                                    }}>{project.client.name}</span>
                                )}
                                {project.build_type && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)' }}>{project.build_type}</span>
                                )}
                                {(project.build_addons ?? []).map(a => (
                                    <span key={a} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>+{a}</span>
                                ))}
                                {project.project_type && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>{project.project_type}</span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                                className="btn-icon"
                                title="Archive project — hides it from the board"
                                onClick={archiveProject}
                                style={{ fontSize: 16 }}
                            >📦</button>
                            <button className="btn-icon" onClick={onClose} aria-label="Close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                            ⏱ <strong style={{ color: 'var(--text-muted)' }}>{formatDuration(totalSeconds)}</strong> logged
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                            ☑ <strong style={{ color: 'var(--text-muted)' }}>{checklistDone}/{checklist.length}</strong> checks
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                            ✓ <strong style={{ color: 'var(--text-muted)' }}>{tasks.length}</strong> tasks
                        </span>
                        {project.due_date && (
                            <span style={{ fontSize: 12, color: isOverdue(project.due_date) ? 'var(--danger)' : 'var(--text-dim)', fontWeight: isOverdue(project.due_date) ? 600 : 400 }}>
                                📅 {new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {isOverdue(project.due_date) && ' ⚠'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 28px' }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: '12px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                                color: tab === t.id ? 'var(--accent-light)' : 'var(--text-muted)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                                transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 6
                            }}
                        >
                            <span>{t.icon}</span>{t.label}
                        </button>
                    ))}
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
                                            {loading ? <span className="spinner" /> : '✓ Save changes'}
                                        </button>
                                    </>
                                ) : (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>✎ Edit</button>
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
                                                    border: `1px solid ${editForm.build_addons.includes(addon) ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
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
                                            <label className="label">Web Build Start Date</label>
                                            <input className="input" type="date" value={editForm.web_build_start_date} onChange={e => setEditForm(f => ({ ...f, web_build_start_date: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label className="label">First Draft Sent Date</label>
                                            <input className="input" type="date" value={editForm.first_draft_sent_date} onChange={e => setEditForm(f => ({ ...f, first_draft_sent_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="label">Build Live Date</label>
                                            <input className="input" type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                                        </div>
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
                                                    <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)', display: 'inline-block' }}>{project.build_type}</span>
                                                    {(project.build_addons ?? []).map(a => (
                                                        <span key={a} style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', display: 'inline-block' }}>+ {a}</span>
                                                    ))}
                                                </div>
                                            ) : '—'
                                        },
                                        { l: 'Type of Project', v: project.project_type ? <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>{project.project_type}</span> : '—' },
                                        { l: 'Build Assigned Date', v: project.start_date ? new Date(project.start_date).toLocaleDateString() : '—' },
                                        { l: 'Web Build Start Date', v: project.web_build_start_date ? new Date(project.web_build_start_date).toLocaleDateString() : '—' },
                                        { l: 'First Draft Sent Date', v: project.first_draft_sent_date ? new Date(project.first_draft_sent_date).toLocaleDateString() : '—' },
                                        {
                                            l: 'Build Live Date', v: (project.due_date || project.build_live_date) ? (
                                                <span style={{ color: isOverdue(project.due_date) ? 'var(--danger)' : 'var(--text)' }}>
                                                    {new Date(project.due_date ?? project.build_live_date!).toLocaleDateString()}{isOverdue(project.due_date) ? ' ⚠' : ''}
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
                                        { l: 'Total time logged', v: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatDuration(totalSeconds)}</span> },
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

                    {/* TASKS */}
                    {tab === 'tasks' && (
                        <div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                <input
                                    className="input"
                                    placeholder="Add a task..."
                                    value={newTaskName}
                                    onChange={e => setNewTaskName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addTask()}
                                />
                                <button className="btn btn-primary btn-sm" onClick={addTask} style={{ flexShrink: 0 }}>Add</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {tasks.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                                        <p style={{ fontSize: 14 }}>No tasks yet. Add your first task above.</p>
                                    </div>
                                )}
                                {tasks.map(task => {
                                    const taskTime = timeEntries
                                        .filter(te => te.task_id === task.id)
                                        .reduce((s, e) => s + (e.duration_seconds || 0), 0)
                                    const isActive = activeTimer?.taskId === task.id

                                    return (
                                        <div key={task.id} style={{
                                            display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 14,
                                            padding: '10px 14px', background: isActive ? 'var(--accent-dim)' : 'var(--surface2)',
                                            border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10,
                                            marginBottom: 8, transition: 'all 0.2s'
                                        }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{task.name}</div>
                                                {taskTime > 0 && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                                                        {formatDuration(taskTime)} logged
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {taskTime > 0 && (
                                                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                        {formatEntryTime(taskTime)}
                                                    </span>
                                                )}
                                                <button
                                                    title={isActive ? 'Stop timer' : 'Start timer on this task'}
                                                    onClick={() => isActive
                                                        ? stopTimer()
                                                        : startTimer({ projectId: project.id, projectName: project.name, taskId: task.id, taskName: task.name, mode: 'task' })
                                                    }
                                                    style={{
                                                        width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: isActive ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                                                        color: isActive ? 'var(--danger)' : 'var(--accent-light)',
                                                        transition: 'all 0.15s',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {isActive
                                                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                                                    }
                                                </button>
                                            </div>

                                            <button
                                                className="btn-icon btn-sm"
                                                style={{ color: 'var(--text-dim)' }}
                                                onClick={() => deleteTask(task.id)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

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
                            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                                <div style={{ flex: 1, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-light)' }}>{formatDuration(totalSeconds)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total logged</div>
                                </div>
                                <div style={{ flex: 1, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{timeEntries.length}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sessions</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {timeEntries.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                                        <p>No time logged yet.</p>
                                    </div>
                                )}
                                {timeEntries.map(entry => {
                                    const task = tasks.find(t => t.id === entry.task_id)
                                    return (
                                        <div key={entry.id} style={{
                                            padding: '12px 14px', background: 'var(--surface2)',
                                            border: '1px solid var(--border)', borderRadius: 10,
                                            display: 'flex', alignItems: 'center', gap: 12
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {new Date(entry.started_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    {' · '}
                                                    {new Date(entry.started_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 2, fontWeight: 700 }}>
                                                    {task ? task.name : 'General Project Time'}
                                                </div>
                                                {entry.notes && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1, fontStyle: 'italic' }}>"{entry.notes}"</div>}
                                            </div>
                                            <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                                                {entry.duration_seconds ? formatDuration(entry.duration_seconds) : '—'}
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
                                    Post Log
                                </button>
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
