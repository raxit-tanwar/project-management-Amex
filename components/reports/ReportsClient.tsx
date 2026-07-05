'use client'

import { useState } from 'react'
import { formatDuration } from '@/lib/utils'
import {
    BarChart, Bar, PieChart, Pie, LineChart, Line,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    type TooltipContentProps
} from 'recharts'
import { BarChart3, Clock, TrendingUp, Download, type LucideIcon } from 'lucide-react'

interface Project {
    id: string; name: string; build_type?: string; project_type?: string; stage_id?: string; created_at: string; archived: boolean
}
interface Stage { id: string; name: string; color: string }
interface TimeEntry { id: string; project_id?: string; started_at: string; duration_seconds?: number }

type ReportTab = 'status' | 'time' | 'stage'

const TABS: { id: ReportTab; label: string; icon: LucideIcon }[] = [
    { id: 'status', label: 'Project Status', icon: BarChart3 },
    { id: 'time', label: 'Time Report', icon: Clock },
    { id: 'stage', label: 'Stage Movement', icon: TrendingUp },
]

const CHART_COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

export default function ReportsClient({ projects: allProjects, stages, timeEntries: allTimeEntries }: {
    projects: Project[]; stages: Stage[]; timeEntries: TimeEntry[]
}) {
    const [tab, setTab] = useState<ReportTab>('status')
    
    // Date filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const setPreset = (preset: string) => {
        const now = new Date()
        let start = new Date()
        let end = new Date()

        switch (preset) {
            case 'this-week':
                start.setDate(now.getDate() - now.getDay())
                break
            case 'last-week':
                start.setDate(now.getDate() - now.getDay() - 7)
                end.setDate(now.getDate() - now.getDay() - 1)
                break
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1)
                break
            case 'last-month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                end = new Date(now.getFullYear(), now.getMonth(), 0)
                break
            case 'today':
                start = new Date()
                break
        }
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(end.toISOString().split('T')[0])
    }

    const timeEntries = allTimeEntries.filter(e => {
        const d = e.started_at?.split('T')[0]
        return d && d >= startDate && d <= endDate
    })

    const projects = allProjects
    const buildAssignedIds = new Set(stages.filter(s => s.name === 'Build Assigned').map(s => s.id))
    const liveStageIds = new Set(stages.filter(s => s.name === 'Live').map(s => s.id))
    const totalProjects = projects.filter(p => !p.archived).length

    // Status data
    const statusData = stages.map(s => ({
        name: s.name,
        count: projects.filter(p => p.stage_id === s.id && !p.archived).length,
        color: s.color
    }))

    // Time data per project
    const timePerProject = projects.map(p => ({
        name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
        hours: +(timeEntries.filter(e => e.project_id === p.id).reduce((s, e) => s + (e.duration_seconds || 0), 0) / 3600).toFixed(1)
    })).filter(p => p.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 10)

    // Daily time over last 14 days
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (13 - i))
        const dayStr = d.toISOString().slice(0, 10)
        const seconds = timeEntries.filter(e => e.started_at?.slice(0, 10) === dayStr).reduce((s, e) => s + (e.duration_seconds || 0), 0)
        return { day: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), hours: +(seconds / 3600).toFixed(1) }
    })

    const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0)

    // Stage movement (age estimate from project creation)
    const stageData = stages.map(s => ({
        name: s.name,
        count: projects.filter(p => p.stage_id === s.id).length,
        color: s.color
    }))

    const exportCSV = (data: Record<string, unknown>[], filename: string) => {
        if (data.length === 0) return
        const keys = Object.keys(data[0])
        const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        a.download = filename
        a.click()
    }

    const customTooltip = ({ active, payload, label }: TooltipContentProps) => {
        if (!active || !payload?.length) return null
        return (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                {payload.map(p => (
                    <p key={p.name} style={{ color: 'var(--text)', fontWeight: 700 }}>{p.value} {p.name === 'hours' ? 'h' : ''}</p>
                ))}
            </div>
        )
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Filter Bar */}
            <div style={{
                padding: '16px 28px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                background: 'var(--surface)', flexShrink: 0, gap: 24,
                boxShadow: 'var(--shadow-xs)'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Range Preset</span>
                        <select
                            className="input"
                            onChange={e => setPreset(e.target.value)}
                            style={{ height: 34, fontSize: 13, minWidth: 140 }}
                            defaultValue="custom"
                        >
                            <option value="custom">Custom Range</option>
                            <option value="today">Today</option>
                            <option value="this-week">This Week</option>
                            <option value="last-week">Last Week</option>
                            <option value="this-month">This Month</option>
                            <option value="last-month">Last Month</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</span>
                        <input
                            type="date"
                            className="input"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ height: 34, fontSize: 13, padding: '0 12px', width: 150 }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
                        <input
                            type="date"
                            className="input"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={{ height: 34, fontSize: 13, padding: '0 12px', width: 150 }}
                        />
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => {
                        if (tab === 'time') exportCSV(timePerProject as unknown as Record<string, unknown>[], 'time-report.csv')
                        if (tab === 'status') exportCSV(statusData as unknown as Record<string, unknown>[], 'status-report.csv')
                    }}
                >
                    <Download size={14} /> Download Report
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px', background: 'var(--surface)', flexShrink: 0 }}>
                {TABS.map(t => {
                    const TabIcon = t.icon
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '12px 16px', fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
                            color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <TabIcon size={14} />{t.label}
                        </button>
                    )
                })}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '28px' }}>

                {/* PROJECT STATUS */}
                {tab === 'status' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            {[
                                { label: 'Total projects', value: totalProjects, color: 'var(--accent-light)' },
                                { label: 'In Progress', value: projects.filter(p => !p.archived && !buildAssignedIds.has(p.stage_id ?? '')).length, color: 'var(--accent-light)' },
                                { label: 'Live', value: projects.filter(p => !p.archived && liveStageIds.has(p.stage_id ?? '')).length, color: 'var(--success)' },
                                { label: 'Total time', value: formatDuration(totalSeconds), color: 'var(--warning)' },
                            ].map(stat => (
                                <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '20px' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: typeof stat.value === 'string' ? 'monospace' : 'inherit' }}>{stat.value}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Projects by Stage</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={statusData} barSize={36}>
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={customTooltip} />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Projects">
                                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.8} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* TIME REPORT */}
                {tab === 'time' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            {[
                                { label: 'Total time logged', value: formatDuration(totalSeconds) },
                                { label: 'Sessions recorded', value: timeEntries.length },
                                { label: 'Projects tracked', value: new Set(timeEntries.map(e => e.project_id).filter(Boolean)).size },
                            ].map(stat => (
                                <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '20px' }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Daily hours — Last 14 days</h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={last14Days}>
                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={customTooltip} />
                                    <Line type="monotone" dataKey="hours" stroke="#4f46e5" strokeWidth={2.5} dot={{ fill: '#4f46e5', r: 4 }} name="hours" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Time per project (hours)</h3>
                            {timePerProject.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0' }}>No time logged yet.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={timePerProject} layout="vertical" barSize={20}>
                                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={120} />
                                        <Tooltip content={customTooltip} />
                                        <Bar dataKey="hours" radius={[0, 6, 6, 0]} name="hours">
                                            {timePerProject.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                )}

                {/* STAGE MOVEMENT */}
                {tab === 'stage' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Project distribution by stage</h3>
                            <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
                                <ResponsiveContainer width={220} height={220}>
                                    <PieChart>
                                        <Pie data={stageData.filter(s => s.count > 0)} dataKey="count" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                                            {stageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => [`${v} projects`]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {stageData.map(s => (
                                        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{s.name}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Bottleneck indicator</h3>
                            {stageData.filter(s => s.count > 0).sort((a, b) => b.count - a.count).map(s => (
                                <div key={s.name} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.count} projects</span>
                                    </div>
                                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4, background: s.color,
                                            width: `${totalProjects > 0 ? (s.count / totalProjects) * 100 : 0}%`,
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
