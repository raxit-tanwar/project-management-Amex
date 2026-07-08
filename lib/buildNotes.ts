// Build Notes are organised by build-type category. Each category holds its own
// rich-text (HTML) note, edited in Settings and shown read-only on the Overview page.

export const BUILD_NOTE_CATEGORIES = [
    { id: 'general', label: 'General Information' },
    { id: 'website', label: 'Website' },
    { id: 'mobile', label: 'Mobile App' },
] as const

export type BuildNoteCategoryId = typeof BUILD_NOTE_CATEGORIES[number]['id']

// Map of category id -> stored HTML. Stored as a JSONB object on user_settings.build_notes.
export type BuildNotesData = Partial<Record<BuildNoteCategoryId, string>>

// Treat empty / whitespace-only / empty-paragraph HTML as "no content" so the UI can show
// an empty state instead of a blank box.
export function hasNoteContent(html?: string | null): boolean {
    if (!html) return false
    const stripped = html
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, '')
        .trim()
    return stripped.length > 0
}

// Normalise whatever is stored into a BuildNotesData object. Accepts the JSONB object we
// now store, but also tolerates a legacy single HTML string (or a JSON string) so the app
// keeps working across the storage migration.
export function normalizeBuildNotes(raw: unknown): BuildNotesData {
    if (!raw) return {}
    if (typeof raw === 'string') {
        const s = raw.trim()
        if (s.startsWith('{')) {
            try { return JSON.parse(s) as BuildNotesData } catch { return { general: raw } }
        }
        return { general: raw }
    }
    if (typeof raw === 'object') return raw as BuildNotesData
    return {}
}
