import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}


export function isOverdue(dueDate?: string | null): boolean {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
}

export function daysRemaining(dueDate?: string | null): number | null {
    if (!dueDate) return null
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((due.getTime() - today.getTime()) / 86400000)
}
