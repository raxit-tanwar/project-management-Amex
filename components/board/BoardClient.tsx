'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectCard from './ProjectCard'
import NewProjectModal from './NewProjectModal'
import ProjectDetailPanel from './ProjectDetailPanel'
import { isOverdue } from '@/lib/utils'
import { useTimer } from '@/context/TimerContext'
import { updateProjectStage, updateProjectDates } from '@/app/(dashboard)/actions'
import { Search, Archive, LayoutGrid, List, Plus, ClipboardList, ArrowLeft } from 'lucide-react'

interface Stage { id: string; name: string; color: string; position: number }
interface Project {
    id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string
    build_type?: string; build_addons?: string[]; project_type?: string; stakeholder_name?: string; stakeholder_email?: string
    due_date?: string; build_live_date?: string; start_date?: string; build_assigned_date?: string
    web_build_start_date?: string; first_draft_sent_date?: string; kickoff_call_date?: string
    stage_id?: string; stage?: Stage; archived?: boolean
    tasks?: { id: string; status: string; name: string; estimated_minutes?: number; due_at?: string | null; due_has_time?: boolean }[]
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
    openTab?: string        // which tab to open when auto-opening (e.g. 'timelog')
}

export default function BoardClient({ userId, userDisplayName, initialStages, initialProjects, initialClients, embedded, openProjectId, openTab }: BoardClientProps) {
    const supabase = createClient()
    const { pendingOpen, setPendingOpen } = useTimer()
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
    const [autoOpenTab, setAutoOpenTab] = useState<string | undefined>(undefined)
    const [sortField, setSortField] = useState<'stage' | 'buildType' | 'dueDate' | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [listStageFilter, setListStageFilter] = useState('')
    const [listBuildTypeFilter, setListBuildTypeFilter] = useState('')

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
                tasks(id, status, name, estimated_minutes, due_at, due_has_time),
                checklist_items(id, checked, text, position),
                time_entries(duration_seconds, started_at)
            `).eq('user_id', userId).eq('archived', archived).order('created_at', { ascending: false }),
            supabase.from('clients').select('*').eq('user_id', userId).order('name')
        ])
        if (projData) setProjects(projData)
        if (clientData) setClients(clientData)
    }, [supabase, userId])

    const refresh = useCallback(() => fetchProjects(showArchived), [fetchProjects, showArchived])

    // React to sidebar timer click: pendingOpen is set in TimerContext, consumed here
    useEffect(() => {
        if (!pendingOpen) return
        const p = projects.find(proj => proj.id === pendingOpen.projectId)
        if (p) {
            setSelectedProject(p)
            setAutoOpenTab(pendingOpen.tab)
            setPendingOpen(null)
        }
    }, [pendingOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fallback: also support openProjectId prop (URL-based navigation)
    useEffect(() => {
        if (!openProjectId) return
        const p = projects.find(proj => proj.id === openProjectId)
        if (p) { setSelectedProject(p); setAutoOpenTab(openTab) }
    }, [openProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        setDraggedId(projectId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const moveProjectStage = async (projectId: string, targetStageId: string) => {
        // Optimistic UI — card moves instantly
        setProjects(prev => prev.map(p =>
            p.id === projectId
                ? { ...p, stage_id: targetStageId, stage: stages.find(s => s.id === targetStageId) }
                : p
        ))
        // Persist via server action (avoids browser CORS on PATCH)
        await updateProjectStage(projectId, targetStageId, new Date().toISOString())
    }

    const saveDateCaptureDates = async (projectId: string, dates: Record<string, string>) => {
        const toSave = Object.fromEntries(Object.entries(dates).filter(([, v]) => !!v))
        if (Object.keys(toSave).length > 0) {
            await updateProjectDates(projectId, toSave)
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
        // Time-based filters only apply to the active board, not archived view
        if (!showArchived) {
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
        }
        const q = searchText.toLowerCase()
        if (searchText && !p.name.toLowerCase().includes(q) &&
            !p.event_code?.toLowerCase().includes(q) &&
            !p.stakeholder_name?.toLowerCase().includes(q)) return false
        return true
    })

    const handleListSort = (field: 'stage' | 'buildType' | 'dueDate') => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('asc') }
    }
    const sortIcon = (field: 'stage' | 'buildType' | 'dueDate') =>
        sortField !== field ? '↕' : sortDir === 'asc' ? '↑' : '↓'

    const uniqueStages = [...new Set(projects.map(p => p.stage?.name).filter(Boolean) as string[])].sort()
    const uniqueBuildTypes = [...new Set(projects.map(p => p.build_type).filter(Boolean) as string[])].sort()

    const listProjects = (() => {
        let result = filteredProjects.filter(p => {
            if (listStageFilter && p.stage?.name !== listStageFilter) return false
            if (listBuildTypeFilter && p.build_type !== listBuildTypeFilter) return false
            return true
        })
        if (sortField) {
            result = [...result].sort((a, b) => {
                let aVal: string, bVal: string
                if (sortField === 'stage') { aVal = a.stage?.name ?? ''; bVal = b.stage?.name ?? '' }
                else if (sortField === 'buildType') { aVal = a.build_type ?? ''; bVal = b.build_type ?? '' }
                else { aVal = a.due_date ?? '9999'; bVal = b.due_date ?? '9999' }
                return (sortDir === 'asc' ? 1 : -1) * aVal.localeCompare(bVal)
            })
        }
        return result
    })()

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
                boxShadow: embedded ? 'none' : 'var(--shadow-xs)'
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
                        style={{ maxWidth: embedded ? undefined : 220, paddingLeft: 32, height: 34, fontSize: 13 }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>

                {/* Time filters — only shown on active board, not in archived view */}
                {!showArchived && (
                    <div style={{ display: 'flex', gap: 4 }}>
                        {([
                            { value: 'all', label: 'All' },
                            { value: 'yesterday', label: 'Yesterday' },
                            { value: 'today', label: 'Today' },
                        ] as const).map(f => (
                            <button key={f.value} onClick={() => setViewFilter(f.value)}
                                style={{
                                    padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                                    fontFamily: 'inherit', transition: 'all 0.15s',
                                    background: viewFilter === f.value ? 'var(--accent-dim)' : 'transparent',
                                    color: viewFilter === f.value ? 'var(--accent)' : 'var(--text-muted)',
                                    borderColor: viewFilter === f.value ? 'var(--accent)' : 'var(--border)',
                                }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Archived toggle */}
                <button
                    onClick={() => { const next = !showArchived; setShowArchived(next); fetchProjects(next) }}
                    style={{
                        padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                        fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: showArchived ? 'rgba(217,119,6,0.08)' : 'transparent',
                        color: showArchived ? 'var(--warning)' : 'var(--text-muted)',
                        borderColor: showArchived ? 'rgba(217,119,6,0.4)' : 'var(--border)',
                    }}
                    title={showArchived ? 'Back to active board' : 'View archived projects'}
                >
                    {showArchived ? <ArrowLeft size={13} /> : <Archive size={13} />}
                    {showArchived ? 'Back to Board' : 'Archived'}
                </button>

                {/* Board / List toggle — hidden in archived view */}
                {!showArchived && (
                    <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', marginLeft: 'auto', background: 'var(--surface2)', padding: 2, gap: 2 }}>
                        {(['board', 'list'] as const).map(mode => (
                            <button key={mode} onClick={() => setViewMode(mode)}
                                style={{
                                    padding: '4px 10px', fontSize: 12.5, fontWeight: 500,
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: viewMode === mode ? 'var(--surface)' : 'transparent',
                                    color: viewMode === mode ? 'var(--text)' : 'var(--text-muted)',
                                    boxShadow: viewMode === mode ? 'var(--shadow-xs)' : 'none',
                                    border: 'none', borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                                    fontFamily: 'inherit'
                                }}>
                                {mode === 'board' ? <LayoutGrid size={13} /> : <List size={13} />} {mode}
                            </button>
                        ))}
                    </div>
                )}

                <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(true)}>
                    <Plus size={14} /> New Project
                </button>
            </div>

            {/* Archived view — flat list, no stage columns */}
            {showArchived ? (
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
                    <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {filteredProjects.length} archived project{filteredProjects.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filteredProjects.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                                <Archive size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                                <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>No archived projects</p>
                                <p style={{ fontSize: 13 }}>Projects you archive will appear here.</p>
                            </div>
                        )}
                        {filteredProjects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => { setSelectedProject(project); setAutoOpenTab(undefined) }}
                                style={{
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 16,
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                                        {project.name}
                                    </div>
                                    {project.event_code && (
                                        <div style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 700, marginTop: 2 }}>
                                            {project.event_code}
                                        </div>
                                    )}
                                    {project.client?.name && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                                            background: `${project.client_color ?? '#4f46e5'}18`,
                                            color: project.client_color ?? '#4f46e5', marginTop: 4, display: 'inline-block'
                                        }}>{project.client.name}</span>
                                    )}
                                </div>
                                {project.stage && (
                                    <span style={{
                                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                        background: `${project.stage.color}18`, color: project.stage.color, flexShrink: 0
                                    }}>{project.stage.name}</span>
                                )}
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                    {formatHours(totalTime(project))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : viewMode === 'board' ? (
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', gap: 16, padding: '20px 24px', alignItems: 'stretch'
                }}>
                    {stages.map(stage => {
                        const stageProjects = filteredProjects.filter(p =>
                            p.stage_id === stage.id || (stage.id === defaultStageId && !p.stage_id)
                        )
                        return (
                            <div
                                key={stage.id}
                                style={{ minWidth: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column' }}
                                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                                onDragLeave={() => setDragOverStage(null)}
                                onDrop={e => handleDrop(e, stage.id)}
                            >
                                {/* Column header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px'
                                }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                                    <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                        {stage.name}
                                    </span>
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                                        padding: '2px 8px', borderRadius: 6,
                                        background: `${stage.color}18`, color: stage.color
                                    }}>{stageProjects.length}</span>
                                </div>

                                {/* Drop zone — fills the rest of the column so the whole column area is droppable */}
                                <div style={{
                                    flex: 1, minHeight: 80, borderRadius: 14,
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
                                                onClick={() => { setSelectedProject(project); setAutoOpenTab(undefined) }}
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
                            display: 'grid', gridTemplateColumns: '1fr 140px 160px 100px 80px 70px',
                            padding: '6px 16px', borderBottom: '2px solid var(--border)',
                        }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project</span>

                            {/* Stage — sortable + filterable */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button onClick={() => handleListSort('stage')} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                    color: sortField === 'stage' ? '#4f46e5' : 'var(--text-dim)',
                                    display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit'
                                }}>
                                    Stage <span style={{ fontSize: 10, opacity: sortField === 'stage' ? 1 : 0.4 }}>{sortIcon('stage')}</span>
                                </button>
                                <select value={listStageFilter} onChange={e => setListStageFilter(e.target.value)} style={{
                                    fontSize: 10, padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit',
                                    border: `1px solid ${listStageFilter ? '#4f46e5' : 'var(--border)'}`,
                                    background: listStageFilter ? 'rgba(79,70,229,0.08)' : 'var(--surface2)',
                                    color: listStageFilter ? '#4f46e5' : 'var(--text-dim)', cursor: 'pointer', maxWidth: '100%'
                                }}>
                                    <option value="">All stages</option>
                                    {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Build Type — sortable + filterable */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button onClick={() => handleListSort('buildType')} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                    color: sortField === 'buildType' ? '#4f46e5' : 'var(--text-dim)',
                                    display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit'
                                }}>
                                    Build Type <span style={{ fontSize: 10, opacity: sortField === 'buildType' ? 1 : 0.4 }}>{sortIcon('buildType')}</span>
                                </button>
                                <select value={listBuildTypeFilter} onChange={e => setListBuildTypeFilter(e.target.value)} style={{
                                    fontSize: 10, padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit',
                                    border: `1px solid ${listBuildTypeFilter ? '#4f46e5' : 'var(--border)'}`,
                                    background: listBuildTypeFilter ? 'rgba(79,70,229,0.08)' : 'var(--surface2)',
                                    color: listBuildTypeFilter ? '#4f46e5' : 'var(--text-dim)', cursor: 'pointer', maxWidth: '100%'
                                }}>
                                    <option value="">All types</option>
                                    {uniqueBuildTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Live Date — sortable */}
                            <button onClick={() => handleListSort('dueDate')} style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                color: sortField === 'dueDate' ? '#4f46e5' : 'var(--text-dim)',
                                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', alignSelf: 'start'
                            }}>
                                Live Date <span style={{ fontSize: 10, opacity: sortField === 'dueDate' ? 1 : 0.4 }}>{sortIcon('dueDate')}</span>
                            </button>

                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checks</span>
                        </div>

                        {listProjects.map(project => {
                            const checklist = project.checklist_items ?? []
                            const done = checklist.filter(c => c.checked).length
                            const overdue = isOverdue(project.due_date)
                            const stageColor = project.stage?.color ?? '#4f46e5'
                            return (
                                <div
                                    key={project.id}
                                    className="card"
                                    style={{
                                        display: 'grid', gridTemplateColumns: '1fr 140px 160px 100px 80px 70px',
                                        padding: '12px 16px', cursor: 'pointer',
                                        borderLeft: `3px solid ${stageColor}`,
                                        transition: 'all 0.15s ease', alignItems: 'center'
                                    }}
                                    onClick={() => { setSelectedProject(project); setAutoOpenTab(undefined) }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                                >
                                    {/* Project name + event code + client — all on one line */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                        {project.event_code && (
                                            <span style={{ color: 'var(--accent-light)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                                {project.event_code}
                                            </span>
                                        )}
                                        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {project.name}
                                        </span>
                                        {project.client?.name && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5, flexShrink: 0,
                                                background: `${project.client_color ?? '#4f46e5'}18`,
                                                color: project.client_color ?? '#4f46e5',
                                            }}>{project.client.name}</span>
                                        )}
                                    </div>

                                    <div>
                                        {project.stage && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
                                                background: `${project.stage.color}18`, color: project.stage.color
                                            }}>{project.stage.name}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {project.build_type ?? '—'}
                                    </div>
                                    <div style={{
                                        fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--text-muted)',
                                        fontWeight: overdue ? 600 : 400
                                    }}>
                                        {project.due_date ? new Date(project.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                                        {overdue && ' · overdue'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        {formatHours(totalTime(project))}
                                    </div>
                                    <div style={{ fontSize: 12, color: done === checklist.length && checklist.length > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {checklist.length > 0 ? `${done}/${checklist.length}` : '—'}
                                    </div>
                                </div>
                            )
                        })}
                        {listProjects.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                                <ClipboardList size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                                <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
                                    {listStageFilter || listBuildTypeFilter ? 'No matching projects' : 'No projects yet'}
                                </p>
                                <p style={{ fontSize: 13 }}>
                                    {listStageFilter || listBuildTypeFilter ? 'Try clearing the filters above.' : 'Create your first project to get started.'}
                                </p>
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
                    initialTab={autoOpenTab as any}
                    onClose={() => { setSelectedProject(null); setAutoOpenTab(undefined) }}
                    onUpdated={async () => {
                        await refresh()
                        setSelectedProject(null)
                        setAutoOpenTab(undefined)
                    }}
                    onArchived={() => {
                        setProjects(prev => prev.filter(p => p.id !== selectedProject.id))
                        setSelectedProject(null)
                        setAutoOpenTab(undefined)
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
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(16,24,40,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 440, padding: 28 }}>

                            {/* Step progress bar */}
                            <div style={{ display: 'flex', gap: 5, marginBottom: 22 }}>
                                {steps.map((s, i) => (
                                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentStep ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s' }} />
                                ))}
                            </div>

                            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Step {currentStep + 1} of {total}
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
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
                                    {isLast ? 'Save & Done' : 'Next'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
