'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectCard from './ProjectCard'
import NewProjectModal from './NewProjectModal'
import ProjectDetailPanel from './ProjectDetailPanel'
import GlobalTimerBar from '../timer/GlobalTimerBar'
import { getPriorityColor, isOverdue } from '@/lib/utils'

interface Stage { id: string; name: string; color: string; position: number }
interface Project {
    id: string; name: string; event_code?: string; client_id?: string; client?: { name: string }; client_color?: string; priority: string
    due_date?: string; stage_id?: string; stage?: Stage
    tasks?: { id: string; status: string; name: string; estimated_minutes?: number }[]
    checklist_items?: { id: string; checked: boolean; text: string; position: number }[]
    time_entries?: { duration_seconds: number }[]
    description?: string; notes?: string; start_date?: string
}

interface Client { id: string; name: string }

interface BoardClientProps {
    userId: string
    userDisplayName?: string
    initialStages: Stage[]
    initialProjects: Project[]
    initialClients: Client[]
}

export default function BoardClient({ userId, userDisplayName, initialStages, initialProjects, initialClients }: BoardClientProps) {
    const supabase = createClient()
    const [stages] = useState(initialStages)
    const [projects, setProjects] = useState(initialProjects)
    const [clients, setClients] = useState(initialClients)
    const [showNewProject, setShowNewProject] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [viewFilter, setViewFilter] = useState<string>('all')
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dragOverStage, setDragOverStage] = useState<string | null>(null)
    const [searchText, setSearchText] = useState('')

    const refresh = useCallback(async () => {
        const [{ data: projData }, { data: clientData }] = await Promise.all([
            supabase.from('projects').select(`
                *,
                stage:stages(id, name, color),
                client:clients(name),
                tasks(id, status, name, estimated_minutes),
                checklist_items(id, checked, text, position),
                time_entries(duration_seconds, started_at)
            `).eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false }),
            supabase.from('clients').select('*').eq('user_id', userId).order('name')
        ])
        if (projData) setProjects(projData)
        if (clientData) setClients(clientData)
    }, [supabase, userId])

    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        setDraggedId(projectId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault()
        if (!draggedId || draggedId === stageId) return
        setProjects(prev => prev.map(p =>
            p.id === draggedId ? { ...p, stage_id: stageId, stage: stages.find(s => s.id === stageId) } : p
        ))
        await supabase.from('projects').update({
            stage_id: stageId,
            stage_changed_at: new Date().toISOString()
        }).eq('id', draggedId)
        setDraggedId(null)
        setDragOverStage(null)
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const filteredProjects = projects.filter(p => {
        if (viewFilter === 'yesterday') {
            const workedYesterday = (p.time_entries ?? []).some((e: any) => e.started_at?.startsWith(yesterdayStr))
            if (!workedYesterday) return false
        } else if (viewFilter === 'today') {
            const workedToday = (p.time_entries ?? []).some((e: any) => e.started_at?.startsWith(todayStr))
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
            {/* Greeting Header */}
            <div style={{ padding: '32px 28px 20px', background: 'var(--bg)' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    Good Morning {userDisplayName || 'Raxit'},
                </h1>
            </div>

            <GlobalTimerBar projects={projects} />


            {/* Topbar */}
            <div style={{
                padding: '20px 28px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
                background: 'var(--surface)'
            }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Project Board</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        className="input"
                        placeholder="Search projects..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ maxWidth: 240 }}
                    />
                    <select
                        className="input"
                        value={viewFilter}
                        onChange={e => setViewFilter(e.target.value)}
                        style={{ maxWidth: 160 }}
                    >
                        <option value="all">All projects</option>
                        <option value="yesterday">Worked on yesterday</option>
                        <option value="today">Working today</option>
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {(['board', 'list'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                style={{
                                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                                    background: viewMode === mode ? 'var(--accent-dim)' : 'transparent',
                                    color: viewMode === mode ? 'var(--accent-light)' : 'var(--text-muted)',
                                    border: 'none', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s'
                                }}
                            >
                                {mode === 'board' ? '⊞' : '☰'} {mode}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(true)}>
                        + New Project
                    </button>
                </div>
            </div>

            {/* Board */}
            {viewMode === 'board' ? (
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', gap: 16, padding: '20px 24px', alignItems: 'flex-start'
                }}>
                    {stages.map(stage => {
                        const stageProjects = filteredProjects.filter(p => p.stage_id === stage.id)
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
                            display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 90px 80px',
                            padding: '8px 16px', fontSize: 11, fontWeight: 700,
                            color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em'
                        }}>
                            <span>Project</span>
                            <span>Stage</span>
                            <span>Priority</span>
                            <span>Due date</span>
                            <span>Time</span>
                            <span>Checklist</span>
                        </div>
                        {filteredProjects.map(project => {
                            const checklist = project.checklist_items ?? []
                            const done = checklist.filter(c => c.checked).length
                            const overdue = isOverdue(project.due_date)
                            return (
                                <div
                                    key={project.id}
                                    className="card"
                                    style={{
                                        display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 90px 80px',
                                        padding: '14px 16px', cursor: 'pointer',
                                        borderLeft: `3px solid ${getPriorityColor(project.priority)}`,
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => setSelectedProject(project)}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{project.name}</div>
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
                                    <div>
                                        <span className={`badge priority-${project.priority}`}>{project.priority}</span>
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
        </div>
    )
}
