'use client'

import React, { useState, useEffect } from 'react'
import { useTimer } from '@/context/TimerContext'
import { formatDuration } from '@/lib/utils'

interface Project {
    id: string
    name: string
    event_code?: string
    tasks?: { id: string; name: string }[]
}

export default function GlobalTimerBar({ projects }: { projects: Project[] }) {
    const { timer, startTimer, stopTimer, selection, setSelection } = useTimer()
    const [taskName, setTaskName] = useState('')

    const selectedProject = projects.find(p => p.id === selection.projectId)
    const tasks = selectedProject?.tasks || []

    useEffect(() => {
        if (timer.isRunning && timer.projectId) {
            setSelection({ projectId: timer.projectId, taskId: timer.taskId || null })
            setTaskName(timer.taskName || '')
        }
    }, [timer.isRunning, timer.projectId, timer.taskId, timer.taskName, setSelection])

    const handleStart = () => {
        if (!selection.projectId) return
        const p = projects.find(proj => proj.id === selection.projectId)
        const t = tasks.find(tsk => tsk.id === selection.taskId)
        
        startTimer({
            projectId: selection.projectId,
            projectName: p?.name,
            taskId: selection.taskId || undefined,
            taskName: t?.name || taskName || 'Unnamed Task',
            mode: selection.taskId ? 'task' : 'project'
        })
    }

    return (
        <div style={{
            padding: '24px 28px',
            marginBottom: 20
        }}>
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '32px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
                
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 24, letterSpacing: '-0.01em' }}>
                    Track your time Here
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    {/* Description */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 18 }}>⚡</div>
                        <input
                            className="input"
                            placeholder="Describe what you are working on..."
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            disabled={timer.isRunning}
                            style={{ 
                                background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600,
                                color: 'var(--text)', padding: 0, height: 'auto', width: '100%'
                            }}
                        />
                    </div>

                    {/* Meta Selectors */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project</span>
                            <select
                                className="input"
                                value={selection.projectId || ''}
                                onChange={e => {
                                    const pid = e.target.value || null
                                    setSelection({ projectId: pid, taskId: null })
                                }}
                                disabled={timer.isRunning}
                                style={{ 
                                    minWidth: 180, height: 40, background: 'var(--surface2)', borderRadius: 8
                                }}
                            >
                                <option value="">Select Project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.event_code ? `[${p.event_code}] ` : ''}{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task</span>
                            <select
                                className="input"
                                value={selection.taskId || ''}
                                onChange={e => setSelection({ ...selection, taskId: e.target.value || null })}
                                disabled={timer.isRunning || !selection.projectId}
                                style={{ 
                                    minWidth: 160, height: 40, background: 'var(--surface2)', borderRadius: 8
                                }}
                            >
                                <option value="">(Optional task)</option>
                                {tasks.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Timer Display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingLeft: 20, borderLeft: '1px solid var(--border)' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: timer.isRunning ? 'var(--success)' : 'var(--text-dim)', marginBottom: 2 }}>
                                {timer.isRunning ? 'ACTIVE SESSION' : 'IDLE'}
                            </div>
                            <div style={{ 
                                fontSize: 32, fontWeight: 900, fontFamily: 'monospace', 
                                color: timer.isRunning ? 'var(--success)' : 'var(--text)',
                                letterSpacing: '0.05em', lineHeight: 1
                            }}>
                                {formatDuration(timer.seconds)}
                            </div>
                        </div>

                        {timer.isRunning ? (
                            <button 
                                className="btn btn-danger" 
                                onClick={() => stopTimer()}
                                style={{ height: 48, minWidth: 90, borderRadius: 12, fontWeight: 800, fontSize: 15 }}
                            >
                                Stop
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                onClick={handleStart}
                                disabled={!selection.projectId}
                                style={{ height: 48, minWidth: 110, borderRadius: 12, fontWeight: 800, fontSize: 15, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                            >
                                Start
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
