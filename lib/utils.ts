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

// Datetime-aware overdue check for action items.
// - If the due value carries a meaningful time-of-day, compare the timestamp directly.
// - If it's date-only, it's only overdue once that whole calendar day has passed
//   (i.e. from the start of the next day), so a task "due today" isn't flagged at 00:00.
export function isTaskOverdue(dueAt?: string | null, hasTime?: boolean): boolean {
    if (!dueAt) return false
    const due = new Date(dueAt)
    if (isNaN(due.getTime())) return false
    if (hasTime) return due < new Date()
    const endOfDay = new Date(due)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay < new Date()
}

export function daysRemaining(dueDate?: string | null): number | null {
    if (!dueDate) return null
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((due.getTime() - today.getTime()) / 86400000)
}
