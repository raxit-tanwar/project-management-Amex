'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stage { id: string; name: string; color: string }
interface Client { id: string; name: string }

interface NewProjectModalProps {
    stages: Stage[]
    clients: Client[]
    userId: string
    onClose: () => void
    onCreated: () => void
}

const PRIMARY_BUILD_TYPES = [
    'Registration Website',
    'Website + Attendee Hub',
    'Attendee hub + Event App',
    'Website + Event App',
    'Website + Attendee hub + Event App',
]

const BUILD_ADDONS = [
    'Stand alone Survey',
    'On Arrival',
    'Exhibitor Management',
]

const PROJECT_TYPES = ['In person Event', 'Virtual Event', 'Hybrid Event']

export default function NewProjectModal({ stages, clients: initialClients, userId, onClose, onCreated }: NewProjectModalProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [clients, setClients] = useState(initialClients)
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [selectedAddons, setSelectedAddons] = useState<string[]>([])

    function toggleAddon(addon: string) {
        setSelectedAddons(prev =>
            prev.includes(addon) ? prev.filter(a => a !== addon) : [...prev, addon]
        )
    }

    async function handleAddClient() {
        if (!newClientName.trim()) return
        const { data, error } = await supabase.from('clients').insert({
            user_id: userId, name: newClientName.trim()
        }).select().single()
        if (error) { setError(error.message); return }
        if (data) {
            setClients(prev => [...prev, data])
            setNewClientName('')
            setIsAddingClient(false)
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const form = new FormData(e.currentTarget)

        const payload = {
            user_id: userId,
            name: form.get('name') as string,
            event_code: form.get('event_code') as string || null,
            client_id: form.get('client_id') as string || null,
            stage_id: form.get('stage_id') as string || null,
            build_type: form.get('build_type') as string || null,
            build_addons: selectedAddons.length > 0 ? selectedAddons : null,
            project_type: form.get('project_type') as string || null,
            stakeholder_name: form.get('stakeholder_name') as string || null,
            stakeholder_email: form.get('stakeholder_email') as string || null,
            start_date: form.get('start_date') as string || null,
            build_assigned_date: form.get('start_date') as string || null,
            notes: form.get('notes') as string || null,
        }

        const { data: project, error: projError } = await supabase.from('projects').insert(payload).select().single()
        if (projError) { setError(projError.message); setLoading(false); return }

        // Copy default checklist template
        const { data: templates } = await supabase
            .from('checklist_templates')
            .select('*')
            .eq('user_id', userId)
            .order('position')

        if (templates && templates.length > 0 && project) {
            await supabase.from('checklist_items').insert(
                templates.map((t, i) => ({
                    project_id: project.id,
                    user_id: userId,
                    text: t.text,
                    position: i
                }))
            )
        }

        setLoading(false)
        onCreated()
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end'
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="slide-in" style={{
                width: '100%', maxWidth: 760, height: '100vh',
                background: 'var(--surface)', borderLeft: '1px solid var(--border)',
                overflow: 'auto', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 800 }}>New Build Project</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Fill in the project details below</p>
                    </div>
                    <button className="btn-icon" onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

                    {/* Row 1: Project Name + Event Code */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div>
                            <label className="label" htmlFor="proj-name">Project Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input id="proj-name" name="name" className="input" required placeholder="e.g. Annual Conference 2026" />
                        </div>
                        <div>
                            <label className="label" htmlFor="proj-code">Event Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input id="proj-code" name="event_code" className="input" required placeholder="e.g. EVT-2026-001 (from Cvent)" />
                        </div>
                    </div>

                    {/* Row 2: Type of Build + Type of Project */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div>
                            <label className="label" htmlFor="proj-build-type">Type of Build <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select id="proj-build-type" name="build_type" className="input" required defaultValue="">
                                <option value="" disabled>Select build type…</option>
                                {PRIMARY_BUILD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label" htmlFor="proj-project-type">Type of Project <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select id="proj-project-type" name="project_type" className="input" required defaultValue="">
                                <option value="" disabled>Select project type…</option>
                                {PROJECT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Add-ons (full width, horizontal chips) */}
                    <div>
                        <label className="label">Add-ons <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                            {BUILD_ADDONS.map(addon => (
                                <button
                                    key={addon} type="button" onClick={() => toggleAddon(addon)}
                                    style={{
                                        padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                                        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                                        background: selectedAddons.includes(addon) ? 'var(--accent-dim)' : 'var(--surface2)',
                                        border: `1.5px solid ${selectedAddons.includes(addon) ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                                        color: selectedAddons.includes(addon) ? 'var(--accent-light)' : 'var(--text-muted)',
                                    }}
                                >
                                    {selectedAddons.includes(addon) ? '✓ ' : ''}{addon}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row 4: Client + Initial Stage */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label className="label" style={{ marginBottom: 0 }}>Client <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <button type="button" onClick={() => setIsAddingClient(!isAddingClient)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                    {isAddingClient ? '✕ Cancel' : '+ New Client'}
                                </button>
                            </div>
                            {isAddingClient ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="input" placeholder="Client name…" value={newClientName} onChange={e => setNewClientName(e.target.value)} autoFocus />
                                    <button type="button" onClick={handleAddClient} className="btn btn-primary" style={{ padding: '0 12px' }}>Save</button>
                                </div>
                            ) : (
                                <select name="client_id" className="input" required defaultValue={clients.find(c => c.name === 'EY')?.id ?? ''}>
                                    <option value="">Select a client…</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="label" htmlFor="proj-stage">Initial Stage <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select id="proj-stage" name="stage_id" className="input" required defaultValue={(stages.find(s => s.name === 'Project Assigned') ?? stages[0])?.id ?? ''}>
                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 5: Stakeholder Name + Email */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div>
                            <label className="label" htmlFor="proj-stakeholder-name">Build Stakeholder Name</label>
                            <input id="proj-stakeholder-name" name="stakeholder_name" className="input" placeholder="e.g. Jane Smith" />
                        </div>
                        <div>
                            <label className="label" htmlFor="proj-stakeholder-email">Build Stakeholder Email</label>
                            <input id="proj-stakeholder-email" name="stakeholder_email" type="email" className="input" placeholder="jane@company.com" />
                        </div>
                    </div>

                    {/* Row 6: Build Assigned Date (only date in the form — defaults to today) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div>
                            <label className="label" htmlFor="proj-start">Build Assigned Date <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input id="proj-start" name="start_date" type="date" className="input" required
                                defaultValue={new Date().toISOString().split('T')[0]} />
                            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Defaults to today — change if needed.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 14px', background: 'rgba(99,102,241,0.05)', borderRadius: 10, border: '1px dashed rgba(99,102,241,0.2)' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                                <strong style={{ color: 'var(--accent-light)' }}>Other dates are captured automatically</strong> as you move the project through stages on the board:
                            </p>
                            <ul style={{ fontSize: 11, color: 'var(--text-dim)', margin: '6px 0 0', paddingLeft: 16, lineHeight: 1.8 }}>
                                <li>Kick-off Call → Kick-off Date</li>
                                <li>In Build → Web Build Start Date</li>
                                <li>First Draft Sent → Draft Date</li>
                                <li>Live → Build Live Date</li>
                            </ul>
                        </div>
                    </div>

                    {/* Row 7: Build Notes (full width) */}
                    <div>
                        <label className="label" htmlFor="proj-notes">Build Notes</label>
                        <textarea id="proj-notes" name="notes" className="input" placeholder="Any additional context…" rows={3} />
                    </div>

                    {error && (
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: 13 }}>
                            ⚠ {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? <span className="spinner" /> : 'Create Project →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
