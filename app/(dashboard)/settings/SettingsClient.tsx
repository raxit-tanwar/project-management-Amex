'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stage { id: string; name: string; color: string; position: number }
interface Template { id: string; text: string; position: number }
interface Client { id: string; name: string }
interface Settings { work_start_time?: string; work_end_time?: string; idle_alert_minutes?: number; long_session_alert_minutes?: number }

const STAGE_COLORS = ['#64748b', '#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4', '#ec4899']
const LOCKED_STAGE_NAME = 'Project Assigned'

type SettingsTab = 'stages' | 'clients' | 'checklist' | 'timer' | 'data'

export default function SettingsClient({ userId, initialStages, initialTemplates, initialSettings, initialClients }: {
    userId: string
    initialStages: Stage[]
    initialTemplates: Template[]
    initialSettings?: Settings | null
    initialClients: Client[]
}) {
    const supabase = createClient()
    const [tab, setTab] = useState<SettingsTab>('stages')
    const [stages, setStages] = useState(initialStages)
    const [templates, setTemplates] = useState(initialTemplates)
    const [clients, setClients] = useState(initialClients)
    const [settings, setSettings] = useState<Settings>(initialSettings ?? {})
    const [saved, setSaved] = useState(false)
    const [newStageName, setNewStageName] = useState('')
    const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[1])
    const [newTemplateText, setNewTemplateText] = useState('')
    const [newClientName, setNewClientName] = useState('')
    const [draggedStageId, setDraggedStageId] = useState<string | null>(null)
    const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

    const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

    // Stages
    const addStage = async () => {
        if (!newStageName.trim()) return
        const pos = stages.length
        const { data } = await supabase.from('stages').insert({
            user_id: userId, name: newStageName.trim(), color: newStageColor, position: pos
        }).select().single()
        if (data) setStages(prev => [...prev, data])
        setNewStageName('')
        showSaved()
    }

    const deleteStage = async (id: string) => {
        if (!confirm('Delete this stage? Projects in it will have no stage.')) return
        await supabase.from('stages').delete().eq('id', id)
        setStages(prev => prev.filter(s => s.id !== id))
        showSaved()
    }

    const updateStageName = async (id: string, name: string) => {
        setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s))
        await supabase.from('stages').update({ name }).eq('id', id)
    }

    const handleStageDrop = async (targetId: string) => {
        if (!draggedStageId || draggedStageId === targetId) return
        setDraggedStageId(null)
        setDragOverStageId(null)

        const locked = stages.find(s => s.name === LOCKED_STAGE_NAME)
        if (targetId === locked?.id) return // cannot drop onto the locked stage slot

        const reordered = [...stages]
        const fromIdx = reordered.findIndex(s => s.id === draggedStageId)
        const toIdx = reordered.findIndex(s => s.id === targetId)
        const [moved] = reordered.splice(fromIdx, 1)
        reordered.splice(toIdx, 0, moved)

        // Locked stage must always be at position 0 — push it back if displaced
        const lockedIdx = reordered.findIndex(s => s.name === LOCKED_STAGE_NAME)
        if (lockedIdx > 0) {
            const [lockedStage] = reordered.splice(lockedIdx, 1)
            reordered.unshift(lockedStage)
        }

        const withPositions = reordered.map((s, i) => ({ ...s, position: i }))
        setStages(withPositions)

        await Promise.all(
            withPositions.map(s => supabase.from('stages').update({ position: s.position }).eq('id', s.id))
        )
        showSaved()
    }

    // Templates
    const addTemplate = async () => {
        if (!newTemplateText.trim()) return
        const { data } = await supabase.from('checklist_templates').insert({
            user_id: userId, text: newTemplateText.trim(), position: templates.length
        }).select().single()
        if (data) setTemplates(prev => [...prev, data])
        setNewTemplateText('')
        showSaved()
    }

    const deleteTemplate = async (id: string) => {
        await supabase.from('checklist_templates').delete().eq('id', id)
        setTemplates(prev => prev.filter(t => t.id !== id))
    }

    // Clients
    const addClient = async () => {
        if (!newClientName.trim()) return
        const { data } = await supabase.from('clients').insert({
            user_id: userId, name: newClientName.trim()
        }).select().single()
        if (data) setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        setNewClientName('')
        showSaved()
    }

    const deleteClient = async (id: string) => {
        if (!confirm('Delete this client? Projects linked to this client will be unlinked.')) return
        await supabase.from('clients').delete().eq('id', id)
        setClients(prev => prev.filter(c => c.id !== id))
        showSaved()
    }

    // Settings save
    const saveSettings = async () => {
        await supabase.from('user_settings').update({
            ...settings, updated_at: new Date().toISOString()
        }).eq('id', userId)
        showSaved()
    }

    // Data export
    const exportData = async () => {
        const [{ data: projects }, { data: tasks }, { data: timeEntries }, { data: fetchedClients }] = await Promise.all([
            supabase.from('projects').select('*').eq('user_id', userId),
            supabase.from('tasks').select('*').eq('user_id', userId),
            supabase.from('time_entries').select('*').eq('user_id', userId),
            supabase.from('clients').select('*').eq('user_id', userId),
        ])
        const blob = new Blob([JSON.stringify({ projects, tasks, timeEntries, stages, templates, clients: fetchedClients }, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `flowdesk-export-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
    }

    const TABS: { id: SettingsTab; label: string; icon: string }[] = [
        { id: 'stages', label: 'Stages', icon: '⚡' },
        { id: 'clients', label: 'Clients', icon: '👤' },
        { id: 'checklist', label: 'Checklist Template', icon: '☑' },
        { id: 'timer', label: 'Timer Preferences', icon: '⏱' },
        { id: 'data', label: 'Data', icon: '💾' },
    ]

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '20px 28px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', flexShrink: 0
            }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Settings</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Customize your FlowDesk workspace</p>
                </div>
                {saved && (
                    <div style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                        color: 'var(--success)', fontSize: 13, fontWeight: 600
                    }}>✓ Saved</div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px', background: 'var(--surface)', flexShrink: 0 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: '12px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                        color: tab === t.id ? 'var(--accent-light)' : 'var(--text-muted)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '28px', maxWidth: 680 }}>

                {/* STAGES */}
                {tab === 'stages' && (
                    <div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                            Manage the pipeline stages shown on your Kanban board. Reordering is reflected immediately.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                            {stages.map((stage) => {
                                const isLocked = stage.name === LOCKED_STAGE_NAME
                                const isDragging = draggedStageId === stage.id
                                const isDragOver = dragOverStageId === stage.id
                                return (
                                    <div
                                        key={stage.id}
                                        draggable={!isLocked}
                                        onDragStart={() => !isLocked && setDraggedStageId(stage.id)}
                                        onDragOver={e => { e.preventDefault(); if (!isLocked && draggedStageId !== stage.id) setDragOverStageId(stage.id) }}
                                        onDragLeave={() => setDragOverStageId(null)}
                                        onDrop={() => handleStageDrop(stage.id)}
                                        onDragEnd={() => { setDraggedStageId(null); setDragOverStageId(null) }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', background: isDragOver ? 'rgba(99,102,241,0.08)' : 'var(--surface2)',
                                            border: `1px solid ${isDragOver ? 'rgba(99,102,241,0.4)' : isLocked ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                                            borderRadius: 10, opacity: isDragging ? 0.4 : 1,
                                            cursor: isLocked ? 'default' : 'grab',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        {/* Drag handle or lock */}
                                        {isLocked ? (
                                            <span title="Default stage — always position 0" style={{ fontSize: 13, flexShrink: 0, opacity: 0.5 }}>🔒</span>
                                        ) : (
                                            <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0, lineHeight: 1, cursor: 'grab' }}>⠿</span>
                                        )}
                                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                                        <input
                                            className="input"
                                            defaultValue={stage.name}
                                            onBlur={e => updateStageName(stage.id, e.target.value)}
                                            style={{ flex: 1, background: 'transparent', border: 'none', padding: '0', fontSize: 14, fontWeight: 600, boxShadow: 'none' }}
                                        />
                                        {isLocked && (
                                            <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>Default</span>
                                        )}
                                        <button onClick={() => !isLocked && deleteStage(stage.id)} disabled={isLocked} className="btn-icon" style={{ color: isLocked ? 'var(--text-dim)' : 'var(--danger)', opacity: isLocked ? 0.3 : 1 }} title={isLocked ? 'Cannot delete default stage' : 'Delete stage'}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input
                                className="input"
                                placeholder="New stage name..."
                                value={newStageName}
                                onChange={e => setNewStageName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addStage()}
                            />
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                {STAGE_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setNewStageColor(c)} style={{
                                        width: 22, height: 22, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                                        outline: newStageColor === c ? '2px solid white' : '2px solid transparent', outlineOffset: 2
                                    }} />
                                ))}
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={addStage} style={{ flexShrink: 0 }}>Add stage</button>
                        </div>
                    </div>
                )}

                {/* CHECKLIST TEMPLATE */}
                {tab === 'checklist' && (
                    <div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                            These items are automatically added to every new project&apos;s checklist. Edit them here to update your default template.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                            {templates.map(t => (
                                <div key={t.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10
                                }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>☑</span>
                                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{t.text}</span>
                                    <button onClick={() => deleteTemplate(t.id)} className="btn-icon" style={{ color: 'var(--danger)' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {templates.length === 0 && (
                                <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>No template items yet.</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input
                                className="input"
                                placeholder="Add checklist item..."
                                value={newTemplateText}
                                onChange={e => setNewTemplateText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTemplate()}
                            />
                            <button className="btn btn-primary btn-sm" onClick={addTemplate} style={{ flexShrink: 0 }}>Add item</button>
                        </div>
                    </div>
                )}

                {/* TIMER PREFERENCES */}
                {tab === 'timer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Configure your work hours and timer alert preferences.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label className="label" htmlFor="work-start">Work day starts</label>
                                <input
                                    id="work-start"
                                    type="time"
                                    className="input"
                                    value={settings.work_start_time ?? '09:00'}
                                    onChange={e => setSettings(prev => ({ ...prev, work_start_time: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label" htmlFor="work-end">Work day ends</label>
                                <input
                                    id="work-end"
                                    type="time"
                                    className="input"
                                    value={settings.work_end_time ?? '18:00'}
                                    onChange={e => setSettings(prev => ({ ...prev, work_end_time: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label" htmlFor="idle-alert">Idle alert after (minutes)</label>
                            <input
                                id="idle-alert"
                                type="number"
                                className="input"
                                min={5} max={120}
                                value={settings.idle_alert_minutes ?? 30}
                                onChange={e => setSettings(prev => ({ ...prev, idle_alert_minutes: parseInt(e.target.value) }))}
                            />
                            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                                Alert if no timer is running during work hours for this many minutes.
                            </p>
                        </div>
                        <div>
                            <label className="label" htmlFor="long-session">Long session alert after (minutes)</label>
                            <input
                                id="long-session"
                                type="number"
                                className="input"
                                min={30} max={480}
                                value={settings.long_session_alert_minutes ?? 120}
                                onChange={e => setSettings(prev => ({ ...prev, long_session_alert_minutes: parseInt(e.target.value) }))}
                            />
                            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                                Warning when a single timer session exceeds this duration without a pause.
                            </p>
                        </div>
                        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={saveSettings}>
                            Save preferences
                        </button>
                    </div>
                )}

                {/* DATA */}
                {tab === 'data' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Export your data</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                                Download all your projects, tasks, time entries, stages, and settings as a JSON file. Use this for backup or migration.
                            </p>
                            <button className="btn btn-surface" onClick={exportData}>
                                ↓ Export all data (JSON)
                            </button>
                        </div>

                        <div className="card" style={{ padding: '24px', borderColor: 'rgba(239,68,68,0.2)' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>⚠ Danger zone</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                                Deleting your account is permanent and cannot be undone. All your projects, tasks, time entries, and settings will be erased.
                            </p>
                            <button className="btn btn-danger" onClick={() => alert('To delete your account, please contact support.')}>
                                Delete account
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
