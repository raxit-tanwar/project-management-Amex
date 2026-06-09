'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectCard from './ProjectCard'
import NewProjectModal from './NewProjectModal'
import ProjectDetailPanel from './ProjectDetailPanel'
import { isOverdue } from '@/lib/utils'

interface Stage { id: string; name: string; color: string; position: number }
interface Project {
    id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string
    build_type?: string; build_addons?: string[]; project_type?: string; stakeholder_name?: string; stakeholder_email?: string
    due_date?: string; build_live_date?: string; start_date?: string; build_assigned_date?: string
    web_build_start_date?: string; first_draft_sent_date?: string; kickoff_call_date?: string
    stage_id?: string; stage?: Stage
    tasks?: { id: string; status: string; name: string; estimated_minutes?: number }[]
    checklist_items?: { id: string; checked: boolean; text: string; position: number }[]
    time_entries?: { duration_seconds: number; started_at?: string }[]
    description?: string; notes?: string
}

interface Client { id: string; name: string }

interface BoardClientProps {
    userId: string
    userDisplayName?: string
    initialStages: Stage[]
    initialProjects: Project[]
    initialClients: Client[]
    embedded?: boolean
    openProjectId?: string  // auto-open this project's detail panel on mount (from sidebar timer)
}

export default function BoardClient({ userId, userDisplayName, initialStages, initialProjects, initialClients, embedded, openProjectId }: BoardClientProps) {
    const supabase = createClient()
    const [stages] = useState(() => [...initialStages].sort((a, b) => a.position - b.position))
    const [projects, setProjects] = useState(initialProjects)
    const [clients, setClients] = useState(initialClients)
    const [showNewProject, setShowNewProject] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [viewFilter, setViewFilter] = useState<string>('all')
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dragOverStage, setDragOverStage] = useState<string | null>(null)
    const [searchText, setSearchText] = useState('')
    const [showArchived, setShowArchived] = useState(false)

    // Date capture modal — opened AFTER stage move completes, completely decoupled from drag
    type DateStep = { stageName: string; field: string; label: string; value: string }
    const [dateCapture, setDateCapture] = useState<{
        projectId: string
        projectName: string
        steps: DateStep[]
        currentStep: number
    } | null>(null)

    // Stage name → date field mapping (keyword-based, case-insensitive)
    const STAGE_DATE_RULES = [
        { match: (n: string) => n.toLowerCase().includes('kick'),                          field: 'kickoff_call_date',     label: 'Kick-off Call Date'      },
        { match: (n: string) => n.toLowerCase().includes('build') && !n.toLowerCase().includes('assigned'), field: 'web_build_start_date',  label: 'Web Build Start Date'    },
        { match: (n: string) => n.toLowerCase().includes('draft'),                         field: 'first_draft_sent_date', label: 'First Draft Sent Date'   },
        { match: (n: string) => n.toLowerCase() === 'live' || n.toLowerCase().startsWith('live'), field: 'build_live_date',       label: 'Build Live Date'         },
    ]

    const fetchProjects = useCallback(async (archived: boolean) => {
        const [{ data: projData }, { data: clientData }] = await Promise.all([
            supabase.from('projects').select(`
                *,
                stage:stages(id, name, color),
                client:clients(name),
                tasks(id, status, name, estimated_minutes),
                checklist_items(id, checked, text, position),
                time_entries(duration_seconds, started_at)
            `).eq('user_id', userId).eq('archived', archived).order('created_at', { ascending: false }),
            supabase.from('clients').select('*').eq('user_id', userId).order('name')
        ])
        if (projData) setProjects(projData)
        if (clientData) setClients(clientData)
    }, [supabase, userId])

    const refresh = useCallback(() => fetchProjects(showArchived), [fetchProjects, showArchived])

    // Auto-open a specific project (e.g. when navigating from the sidebar timer indicator)
    useEffect(() => {
        if (!openProjectId) return
        const p = projects.find(proj => proj.id === openProjectId)
        if (p) setSelectedProject(p)
    }, [openProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        setDraggedId(projectId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const moveProjectStage = async (projectId: string, targetStageId: string) => {
        // 1. Optimistic UI — card moves instantly
        setProjects(prev => prev.map(p =>
            p.id === projectId
                ? { ...p, stage_id: targetStageId, stage: stages.find(s => s.id === targetStageId) }
                : p
        ))
        // 2. Persist to DB
        await supabase.from('projects')
            .update({ stage_id: targetStageId, stage_changed_at: new Date().toISOString() })
            .eq('id', projectId)
    }

    const saveDateCaptureDates = async (projectId: string, dates: Record<string, string>) => {
        const toSave = Object.fromEntries(Object.entries(dates).filter(([, v]) => !!v))
        if (Object.keys(toSave).length > 0) {
            await supabase.from('projects').update(toSave).eq('id', projectId)
            // Update local state so ProjectDetailPanel shows fresh dates immediately
            setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, ...toSave } : p
            ))
        }
    }

    const handleDrop = (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault()
        const projectId = draggedId   // capture synchronously before any state changes
        setDraggedId(null)
        setDragOverStage(null)
        if (!projectId) return

        const project = projects.find(p => p.id === projectId)
        if (!project || project.stage_id === targetStageId) return

        // 1. Move the stage immediately — no blocking
        moveProjectStage(projectId, targetStageId)

        // 2. Work out which stages were passed through (forward moves only, ascending position)
        const sortedStages = [...stages].sort((a, b) => a.position - b.position)
        const fromPos = sortedStages.find(s => s.id === project.stage_id)?.position ?? -1
        const toPos   = sortedStages.find(s => s.id === targetStageId)?.position ?? 0

        // Only prompt for forward moves — collect all traversed stages (including target)
        const traversed = sortedStages.filter(s =>
            s.position > fromPos && s.position <= toPos
        )

        const steps: DateStep[] = traversed
            .map(s => {
                const rule = STAGE_DATE_RULES.find(r => r.match(s.name))
                return rule ? { stageName: s.name, field: rule.field, label: rule.label, value: new Date().toISOString().split('T')[0] } : null
            })
            .filter((s): s is DateStep => s !== null)

        // 3. Open date capture modal if there are dates to collect
        if (steps.length > 0) {
            setDateCapture({ projectId, projectName: project.name, steps, currentStep: 0 })
        }
    }

    const defaultStageId = (stages.find(s => s.name === 'Project Assigned') ?? stages[0])?.id

    const localDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const todayStr = localDateStr(new Date())
    const yDay = new Date(); yDay.setDate(yDay.getDate() - 1)
    const yesterdayStr = localDateStr(yDay)

    const filteredProjects = projects.filter(p => {
        if (viewFilter === 'yesterday') {
            const workedYesterday = (p.time_entries ?? []).some(e =>
                e.started_at ? localDateStr(new Date(e.started_at)) === yesterdayStr : false
            )
            if (!workedYesterday) return false
        } else if (viewFilter === 'today') {
            const workedToday = (p.time_entries ?? []).some(e =>
                e.started_at ? localDateStr(new Date(e.started_at)) === todayStr : false
            )
            if (!workedToday) return false
        }
        
        if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
    })

    const totalTime = (project: Project) =>
        (project.time_entries ?? []).reduce((s, e) => s + (e.duration_seconds || 0), 0)

    const formatHours = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        if (h === 0) return `${m}m`
        return `${h}h ${m}m`
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar — full when standalone, compact when embedded */}
            <div style={{
                padding: embedded ? '10px 16px' : '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                background: 'var(--surface)',
                boxShadow: embedded ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                {!embedded && (
                    <div style={{ marginRight: 4 }}>
                        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>Project Board</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                    </div>
                )}

                {/* Search */}
                <div style={{ position: 'relative', flex: embedded ? 1 : 'none' }}>
                    <input
                        className="input"
                        placeholder="Search projects…"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ maxWidth: embedded ? undefined : 220, paddingLeft: 32, height: 36, fontSize: 13 }}
                    />
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 13 }}>🔍</span>
                </div>

                {/* Filter buttons — more visual than a dropdown */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {([
                        { value: 'all', label: 'All' },
                        { value: 'yesterday', label: 'Yesterday' },
                        { value: 'today', label: 'Today' },
                    ] as const).map(f => (
                        <button key={f.value} onClick={() => setViewFilter(f.value)}
                            style={{
                                padding: '5px 12px', borderRadius: 20, border: '1px solid',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                                background: viewFilter === f.value ? '#6366f1' : 'transparent',
                                color: viewFilter === f.value ? 'white' : 'var(--text-muted)',
                                borderColor: viewFilter === f.value ? '#6366f1' : 'var(--border)',
                            }}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Archived toggle */}
                <button
                    onClick={() => { const next = !showArchived; setShowArchived(next); fetchProjects(next) }}
                    style={{
                        padding: '5px 12px', borderRadius: 20, border: '1px solid',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                        background: showArchived ? 'rgba(245,158,11,0.12)' : 'transparent',
                        color: showArchived ? '#d97706' : 'var(--text-muted)',
                        borderColor: showArchived ? 'rgba(245,158,11,0.4)' : 'var(--border)',
                    }}
                    title={showArchived ? 'Showing archived projects — click to show active' : 'Show archived projects'}
                >
                    📦 {showArchived ? 'Archived' : 'Archived'}
                </button>

                {/* Board / List toggle */}
                <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginLeft: 'auto' }}>
                    {(['board', 'list'] as const).map(mode => (
                        <button key={mode} onClick={() => setViewMode(mode)}
                            style={{
                                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                background: viewMode === mode ? 'var(--accent-dim)' : 'transparent',
                                color: viewMode === mode ? '#6366f1' : 'var(--text-muted)',
                                border: 'none', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                                fontFamily: 'Inter, sans-serif'
                            }}>
                            {mode === 'board' ? '⊞' : '☰'} {mode}
                        </button>
                    ))}
                </div>

                <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(true)}>
                    + New Project
                </button>
            </div>

            {/* Board */}
            {viewMode === 'board' ? (
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', gap: 16, padding: '20px 24px', alignItems: 'flex-start'
                }}>
                    {stages.map(stage => {
                        const stageProjects = filteredProjects.filter(p =>
                            p.stage_id === stage.id || (stage.id === defaultStageId && !p.stage_id)
                        )
                        return (
                            <div
                                key={stage.id}
                                style={{ minWidth: 280, flex: '0 0 280px' }}
                                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                                onDragLeave={() => setDragOverStage(null)}
                                onDrop={e => handleDrop(e, stage.id)}
                            >
                                {/* Column header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px'
                                }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, boxShadow: `0 0 8px ${stage.color}60` }} />
                                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
                                        {stage.name}
                                    </span>
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                                        padding: '2px 8px', borderRadius: 6,
                                        background: `${stage.color}18`, color: stage.color
                                    }}>{stageProjects.length}</span>
                                </div>

                                {/* Drop zone */}
                                <div style={{
                                    minHeight: 80, borderRadius: 14,
                                    border: `2px dashed ${dragOverStage === stage.id ? stage.color : 'transparent'}`,
                                    background: dragOverStage === stage.id ? `${stage.color}08` : 'transparent',
                                    transition: 'all 0.2s ease',
                                    display: 'flex', flexDirection: 'column', gap: 10, padding: dragOverStage === stage.id ? 8 : 0
                                }}>
                                    {stageProjects.map(project => (
                                        <div
                                            key={project.id}
                                            draggable
                                            onDragStart={e => handleDragStart(e, project.id)}
                                            onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                                            style={{ opacity: draggedId === project.id ? 0.5 : 1, cursor: 'grab' }}
                                        >
                                            <ProjectCard
                                                project={project}
                                                totalSeconds={totalTime(project)}
                                                formatHours={formatHours}
                                                onClick={() => setSelectedProject(project)}
                                                onRefresh={refresh}
                                            />
                                        </div>
                                    ))}

                                    {stageProjects.length === 0 && dragOverStage !== stage.id && (
                                        <div style={{
                                            padding: '20px', textAlign: 'center',
                                            color: 'var(--text-dim)', fontSize: 12, fontWeight: 500
                                        }}>
                                            Drop here
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* List view */
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Header row */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 120px 150px 90px 90px 80px',
                            padding: '8px 16px', fontSize: 11, fontWeight: 700,
                            color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em'
                        }}>
                            <span>Project</span>
                            <span>Stage</span>
                            <span>Build Type</span>
                            <span>Live Date</span>
                            <span>Time</span>
                            <span>Checklist</span>
                        </div>
                        {filteredProjects.map(project => {
                            const checklist = project.checklist_items ?? []
                            const done = checklist.filter(c => c.checked).length
                            const overdue = isOverdue(project.due_date)
                            const stageColor = project.stage?.color ?? '#6366f1'
                            return (
                                <div
                                    key={project.id}
                                    className="card"
                                    style={{
                                        display: 'grid', gridTemplateColumns: '1fr 120px 150px 90px 90px 80px',
                                        padding: '14px 16px', cursor: 'pointer',
                                        borderLeft: `3px solid ${stageColor}`,
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => setSelectedProject(project)}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                                            {project.event_code && <span style={{ color: 'var(--accent-light)', marginRight: 6, fontSize: 12 }}>{project.event_code}</span>}
                                            {project.name}
                                        </div>
                                        {project.client?.name && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                                                background: `${project.client_color ?? '#6366f1'}18`,
                                                color: project.client_color ?? '#6366f1', marginTop: 4, display: 'inline-block'
                                            }}>{project.client.name}</span>
                                        )}
                                    </div>
                                    <div>
                                        {project.stage && (
                                            <span style={{
                                                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                                background: `${project.stage.color}18`, color: project.stage.color
                                            }}>{project.stage.name}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>
                                        {project.build_type ?? '—'}
                                    </div>
                                    <div style={{
                                        fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--text-muted)',
                                        fontWeight: overdue ? 600 : 400
                                    }}>
                                        {project.due_date ? new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                                        {overdue && ' ⚠'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {formatHours(totalTime(project))}
                                    </div>
                                    <div style={{ fontSize: 12, color: done === checklist.length && checklist.length > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {checklist.length > 0 ? `${done}/${checklist.length}` : '—'}
                                    </div>
                                </div>
                            )
                        })}
                        {filteredProjects.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                                <p style={{ fontWeight: 600, marginBottom: 8 }}>No projects yet</p>
                                <p style={{ fontSize: 13 }}>Create your first project to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showNewProject && (
                <NewProjectModal
                    stages={stages}
                    clients={clients}
                    userId={userId}
                    onClose={() => setShowNewProject(false)}
                    onCreated={() => { setShowNewProject(false); refresh() }}
                />
            )}

            {selectedProject && (
                <ProjectDetailPanel
                    project={selectedProject}
                    userId={userId}
                    stages={stages}
                    clients={clients}
                    onClose={() => setSelectedProject(null)}
                    onUpdated={async () => {
                        await refresh()
                        setSelectedProject(null)
                    }}
                />
            )}

            {/* Date capture modal — fires AFTER stage move, driven purely by React state */}
            {dateCapture && (() => {
                const { projectId, projectName, steps, currentStep } = dateCapture
                const step = steps[currentStep]
                const total = steps.length
                const isLast = currentStep === total - 1

                const updateValue = (val: string) =>
                    setDateCapture(d => d ? {
                        ...d,
                        steps: d.steps.map((s, i) => i === d.currentStep ? { ...s, value: val } : s)
                    } : null)

                const advance = async (save: boolean) => {
                    const updatedSteps = steps.map((s, i) =>
                        i === currentStep && !save ? { ...s, value: '' } : s
                    )
                    if (isLast) {
                        // Save all collected dates in one shot
                        const dates: Record<string, string> = {}
                        updatedSteps.forEach(s => { if (s.value) dates[s.field] = s.value })
                        await saveDateCaptureDates(projectId, dates)
                        setDateCapture(null)
                    } else {
                        setDateCapture({ ...dateCapture, steps: updatedSteps, currentStep: currentStep + 1 })
                    }
                }

                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', width: '100%', maxWidth: 440, padding: 28 }}>

                            {/* Step progress bar */}
                            <div style={{ display: 'flex', gap: 5, marginBottom: 22 }}>
                                {steps.map((s, i) => (
                                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentStep ? '#6366f1' : 'var(--border)', transition: 'background 0.2s' }} />
                                ))}
                            </div>

                            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Step {currentStep + 1} of {total}
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                                {step.stageName}
                            </h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                                Log the date for <strong style={{ color: 'var(--text)' }}>{projectName}</strong> reaching this stage.
                            </p>

                            <div style={{ marginBottom: 22 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                                    {step.label}
                                </label>
                                <input
                                    key={currentStep}
                                    type="date"
                                    className="input"
                                    value={step.value}
                                    onChange={e => updateValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') advance(true) }}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => advance(false)}>
                                    Skip
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => advance(true)}>
                                    {isLast ? '✓ Save & Done' : 'Next →'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
