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

export function getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
        Low: '#22c55e',
        Medium: '#f59e0b',
        High: '#ef4444',
        Critical: '#dc2626',
    }
    return map[priority] ?? '#6366f1'
}

export function isOverdue(dueDate?: string | null): boolean {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
}
