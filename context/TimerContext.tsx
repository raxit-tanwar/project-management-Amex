'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/utils'

interface TimerState {
    isRunning: boolean
    isPaused: boolean
    seconds: number
    projectId: string | null
    projectName: string | null
    taskId: string | null
    taskName: string | null
    startedAt: Date | null
    mode: 'task' | 'project' | 'free'
}

interface TimerContextType {
    timer: TimerState
    activeTimer: TimerState | null
    displayTime: string
    todaySeconds: number
    startTimer: (opts?: { projectId?: string; projectName?: string; taskId?: string; taskName?: string; mode?: TimerState['mode'] }) => void
    pauseTimer: () => void
    stopTimer: (notes?: string, tag?: string) => Promise<void>
    resetTimer: () => void
    selection: { projectId: string | null; taskId: string | null }
    setSelection: (s: { projectId: string | null; taskId: string | null }) => void
    pendingOpen: { projectId: string; tab: string } | null
    setPendingOpen: (v: { projectId: string; tab: string } | null) => void
}

const defaultTimer: TimerState = {
    isRunning: false,
    isPaused: false,
    seconds: 0,
    projectId: null,
    projectName: null,
    taskId: null,
    taskName: null,
    startedAt: null,
    mode: 'free',
}

const STORAGE_KEY = 'flowdesk_active_timer'

interface PersistedTimer {
    startedAt: number
    projectId: string | null
    projectName: string | null
    taskId: string | null
    taskName: string | null
    mode: TimerState['mode']
}

function saveToStorage(state: TimerState) {
    if (!state.isRunning || !state.startedAt) return
    const data: PersistedTimer = {
        startedAt: state.startedAt.getTime(),
        projectId: state.projectId,
        projectName: state.projectName,
        taskId: state.taskId,
        taskName: state.taskName,
        mode: state.mode,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearStorage() {
    localStorage.removeItem(STORAGE_KEY)
}

function restoreFromStorage(): TimerState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as PersistedTimer
        const elapsed = Math.floor((Date.now() - data.startedAt) / 1000)
        if (elapsed < 0) { clearStorage(); return null }
        return {
            isRunning: true,
            isPaused: false,
            seconds: elapsed,
            startedAt: new Date(data.startedAt),
            projectId: data.projectId,
            projectName: data.projectName,
            taskId: data.taskId,
            taskName: data.taskName,
            mode: data.mode,
        }
    } catch {
        clearStorage()
        return null
    }
}

const TimerContext = createContext<TimerContextType | null>(null)

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [timer, setTimer] = useState<TimerState>(defaultTimer)
    const [selection, setSelection] = useState<{ projectId: string | null; taskId: string | null }>({ projectId: null, taskId: null })
    const [todaySeconds, setTodaySeconds] = useState(0)
    const [pendingOpen, setPendingOpen] = useState<{ projectId: string; tab: string } | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const supabase = createClient()

    const displayTime = formatDuration(timer.seconds)

    const clearInterval_ = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }

    const stopTimer = useCallback(async (notes?: string, tag?: string) => {
        if (timer.startedAt && timer.seconds > 0) {
            try {
                const { data: { user: u }, error } = await supabase.auth.getUser()
                if (u && !error) {
                    const endedAt = new Date()
                    await supabase.from('time_entries').insert({
                        user_id: u.id,
                        project_id: timer.projectId,
                        task_id: timer.taskId,
                        started_at: timer.startedAt.toISOString(),
                        ended_at: endedAt.toISOString(),
                        duration_seconds: timer.seconds,
                        notes: notes || null,
                        tag: tag || null,
                    })
                    setTodaySeconds(s => s + timer.seconds)
                }
            } catch (err) {
                console.error('Failed to save time entry:', err)
            }
        }
        clearStorage()
        setTimer(defaultTimer)
    }, [timer, supabase])

    const startTimer = useCallback(async (opts?: {
        projectId?: string; projectName?: string; taskId?: string; taskName?: string; mode?: TimerState['mode']
    }) => {
        if (timer.isRunning && (timer.taskId !== opts?.taskId || timer.projectId !== opts?.projectId)) {
            await stopTimer('Auto-stopped for new task')
        }

        const newState: TimerState = {
            isRunning: true,
            isPaused: false,
            seconds: 0,
            startedAt: new Date(),
            projectId: opts?.projectId ?? null,
            projectName: opts?.projectName ?? null,
            taskId: opts?.taskId ?? null,
            taskName: opts?.taskName ?? null,
            mode: opts?.mode ?? 'free',
        }
        saveToStorage(newState)
        setTimer(newState)
    }, [timer.isRunning, timer.taskId, timer.projectId, stopTimer])

    const pauseTimer = useCallback(() => {
        clearStorage()
        setTimer(prev => ({ ...prev, isRunning: false, isPaused: true }))
    }, [])

    const resetTimer = useCallback(() => {
        clearInterval_()
        clearStorage()
        setTimer(defaultTimer)
    }, [])

    // Interval tick
    useEffect(() => {
        if (timer.isRunning) {
            intervalRef.current = setInterval(() => {
                setTimer(prev => ({ ...prev, seconds: prev.seconds + 1 }))
            }, 1000)
        } else {
            clearInterval_()
        }
        return clearInterval_
    }, [timer.isRunning])

    // Load today's total on mount, then restore any in-progress timer
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (!user || error) return

                const start = new Date()
                start.setHours(0, 0, 0, 0)
                const { data } = await supabase
                    .from('time_entries')
                    .select('duration_seconds')
                    .eq('user_id', user.id)
                    .gte('started_at', start.toISOString())

                if (data) {
                    setTodaySeconds(data.reduce((sum, e) => sum + (e.duration_seconds || 0), 0))
                }
            } catch (err) {
                console.error('Failed to load today seconds:', err)
            }

            // Restore timer that was running before refresh
            const restored = restoreFromStorage()
            if (restored) setTimer(restored)
        }
        init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <TimerContext.Provider value={{
            timer,
            activeTimer: timer.isRunning ? timer : null,
            displayTime,
            todaySeconds,
            startTimer,
            pauseTimer,
            stopTimer,
            resetTimer,
            selection,
            setSelection,
            pendingOpen,
            setPendingOpen,
        }}>
            {children}
        </TimerContext.Provider>
    )
}

export function useTimer() {
    const ctx = useContext(TimerContext)
    if (!ctx) throw new Error('useTimer must be used within TimerProvider')
    return ctx
}
