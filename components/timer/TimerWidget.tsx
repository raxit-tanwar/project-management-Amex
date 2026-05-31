'use client'

import { useState } from 'react'
import { useTimer } from '@/context/TimerContext'
import { formatDuration } from '@/lib/utils'

export default function TimerWidget() {
    const { timer, displayTime, todaySeconds, startTimer, pauseTimer, stopTimer, resetTimer } = useTimer()
    const [collapsed, setCollapsed] = useState(false)

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    width: 56, height: 56, borderRadius: '50%',
                    background: timer.isRunning
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    color: 'white'
                }}
                title="Open Timer"
                aria-label="Open Timer"
            >
                ⏱
            </button>
        )
    }

    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 280, borderRadius: 18,
            background: 'var(--surface)',
            border: `1px solid ${timer.isRunning ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: timer.isRunning ? 'var(--success)' : timer.isPaused ? 'var(--warning)' : 'var(--text-dim)',
                        boxShadow: timer.isRunning ? '0 0 8px var(--success)' : 'none',
                        transition: 'all 0.3s ease'
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {timer.isRunning ? 'Tracking' : timer.isPaused ? 'Paused' : 'Idle'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => setCollapsed(true)} style={{ padding: 4 }} title="Minimize">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /></svg>
                    </button>
                </div>
            </div>

            {/* Timer display */}
            <div style={{ padding: '16px 14px' }}>
                <div style={{
                    fontFamily: 'monospace', fontSize: 36, fontWeight: 900,
                    letterSpacing: '0.02em', textAlign: 'center', marginBottom: 4,
                    color: timer.isRunning ? 'var(--success)' : timer.isPaused ? 'var(--warning)' : 'var(--text)',
                    transition: 'color 0.3s ease'
                }}>
                    {displayTime}
                </div>

                {(timer.projectName || timer.taskName) && (
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        {timer.taskName && (
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                                📋 {timer.taskName}
                            </div>
                        )}
                        {timer.projectName && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {timer.taskName ? '↳ ' : '📁 '}{timer.projectName}
                            </div>
                        )}
                    </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                    {!timer.isRunning ? (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => startTimer()}
                            style={{ flex: 1 }}
                        >
                            ▶ {timer.isPaused ? 'Resume' : 'Start'}
                        </button>
                    ) : (
                        <button
                            className="btn btn-surface btn-sm"
                            onClick={pauseTimer}
                            style={{ flex: 1 }}
                        >
                            ⏸ Pause
                        </button>
                    )}

                    <button
                        className="btn btn-danger btn-sm"
                        onClick={() => (timer.seconds > 0 ? stopTimer() : resetTimer())}
                        disabled={!timer.isRunning && !timer.isPaused}
                        style={{ padding: '6px 12px' }}
                    >
                        ⏹
                    </button>

                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={resetTimer}
                        disabled={timer.seconds === 0}
                        style={{ padding: '6px 10px' }}
                        title="Reset"
                    >
                        ↺
                    </button>
                </div>

                {/* Today's total */}
                <div style={{
                    padding: '8px 12px', borderRadius: 10,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Today
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {formatDuration(todaySeconds + (timer.isRunning ? timer.seconds : 0))}
                    </span>
                </div>
            </div>
        </div>
    )
}
