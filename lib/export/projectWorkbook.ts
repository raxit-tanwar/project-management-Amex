import ExcelJS from 'exceljs'

// Shapes are intentionally loose (all fields optional/nullable) because the rows come
// straight from Supabase `select('*')` and we want the export to survive missing columns.
export interface ExportProject {
    id: string
    name: string
    event_code?: string | null
    client?: { name?: string | null } | null
    client_color?: string | null
    build_type?: string | null
    build_addons?: string[] | null
    project_type?: string | null
    priority?: string | null
    stakeholder_name?: string | null
    stakeholder_email?: string | null
    start_date?: string | null
    build_assigned_date?: string | null
    kickoff_call_date?: string | null
    web_build_start_date?: string | null
    first_draft_sent_date?: string | null
    due_date?: string | null
    build_live_date?: string | null
    stage?: { name?: string | null; color?: string | null } | null
    archived?: boolean | null
    description?: string | null
    notes?: string | null
}

export interface ExportTask {
    project_id: string
    name?: string | null
    status?: string | null
    due_at?: string | null
    due_has_time?: boolean | null
    assignee?: string | null
    description?: string | null
    position?: number | null
}

export interface ExportChecklistItem {
    project_id: string
    text?: string | null
    checked?: boolean | null
    checked_at?: string | null
    checked_by?: string | null
    position?: number | null
}

export interface ExportTimeEntry {
    project_id: string
    started_at?: string | null
    ended_at?: string | null
    duration_seconds?: number | null
    notes?: string | null
    tag?: string | null
}

export interface ExportNote {
    project_id: string
    content?: string | null
    is_task?: boolean | null
    created_at?: string | null
}

export interface WorkbookInput {
    projects: ExportProject[]
    tasks: ExportTask[]
    checklist: ExportChecklistItem[]
    timeEntries: ExportTimeEntry[]
    notes: ExportNote[]
}

const HEADER_FILL_ARGB = 'FF4F46E5' // matches the app's accent colour
const DATE_FMT = 'dd mmm yyyy'
const DATETIME_FMT = 'dd mmm yyyy hh:mm'

type Col = {
    header: string
    key: string
    width: number
    numFmt?: string
    wrap?: boolean
}

// Parse a stored date/timestamp into a real Date so Excel treats it as a sortable date.
// Date-only values ('yyyy-mm-dd') are pinned to local noon to avoid a timezone shifting
// them onto the previous calendar day.
function toDate(value?: string | null): Date | null {
    if (!value) return null
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
}

function fmtDateShort(d: Date | null): string {
    if (!d) return ''
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDuration(totalSeconds: number): string {
    if (!totalSeconds) return '0m'
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.round((totalSeconds % 3600) / 60)
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
}

function groupBy<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const row of rows) {
        const list = map.get(row.project_id) ?? []
        list.push(row)
        map.set(row.project_id, list)
    }
    return map
}

function addSheet(
    wb: ExcelJS.Workbook,
    name: string,
    cols: Col[],
    rows: Record<string, unknown>[],
): void {
    const ws = wb.addWorksheet(name, {
        views: [{ state: 'frozen', ySplit: 1 }],
    })

    ws.columns = cols.map(c => ({
        header: c.header,
        key: c.key,
        width: c.width,
        style: {
            numFmt: c.numFmt,
            alignment: c.wrap ? { wrapText: true, vertical: 'top' } : { vertical: 'top' },
        },
    }))

    rows.forEach(r => ws.addRow(r))

    // Grow row height to fit multi-line cells (e.g. the inline task / checklist lists)
    // so every line is visible without the reader having to expand the row.
    for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i)
        let maxLines = 1
        row.eachCell({ includeEmpty: false }, cell => {
            if (typeof cell.value === 'string') {
                const lines = cell.value.split('\n').length
                if (lines > maxLines) maxLines = lines
            }
        })
        if (maxLines > 1) row.height = Math.min(maxLines, 40) * 15
    }

    // Style the frozen header row.
    const header = ws.getRow(1)
    header.height = 22
    header.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL_ARGB } }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })

    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: cols.length },
    }
}

/**
 * Build a multi-sheet .xlsx workbook describing the given projects and all their details.
 * Sheets: Projects (one row per project) + Tasks, Checklist, Time Log and Notes
 * (one row per detail item, tagged with its project name).
 */
export async function buildProjectsWorkbook(input: WorkbookInput): Promise<Buffer> {
    const { projects, tasks, checklist, timeEntries, notes } = input

    const tasksByProject = groupBy(tasks)
    const checklistByProject = groupBy(checklist)
    const timeByProject = groupBy(timeEntries)
    const notesByProject = groupBy(notes)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'FlowDesk'
    wb.created = new Date()

    // ── Projects summary sheet ──
    const projectCols: Col[] = [
        { header: 'Project', key: 'name', width: 30 },
        { header: 'Event Code', key: 'event_code', width: 16 },
        { header: 'Stage', key: 'stage', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Client', key: 'client', width: 20 },
        { header: 'Type of Build', key: 'build_type', width: 26 },
        { header: 'Add-ons', key: 'build_addons', width: 26, wrap: true },
        { header: 'Type of Project', key: 'project_type', width: 18 },
        { header: 'Priority', key: 'priority', width: 12 },
        { header: 'Stakeholder', key: 'stakeholder_name', width: 20 },
        { header: 'Stakeholder Email', key: 'stakeholder_email', width: 26 },
        { header: 'Build Assigned', key: 'build_assigned', width: 15, numFmt: DATE_FMT },
        { header: 'Kick-off Call', key: 'kickoff_call_date', width: 15, numFmt: DATE_FMT },
        { header: 'Web Build Start', key: 'web_build_start_date', width: 15, numFmt: DATE_FMT },
        { header: 'First Draft Sent', key: 'first_draft_sent_date', width: 15, numFmt: DATE_FMT },
        { header: 'Build Live Date', key: 'build_live_date', width: 15, numFmt: DATE_FMT },
        { header: 'Tasks', key: 'tasks_list', width: 46, wrap: true },
        { header: 'Checklist', key: 'checklist_list', width: 46, wrap: true },
        { header: 'Time Logged', key: 'time_logged', width: 13 },
        { header: 'Description', key: 'description', width: 40, wrap: true },
        { header: 'Notes', key: 'notes', width: 40, wrap: true },
    ]

    const projectRows = projects.map(p => {
        const pTasks = (tasksByProject.get(p.id) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        const pChecks = (checklistByProject.get(p.id) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        const pTime = timeByProject.get(p.id) ?? []
        const totalSeconds = pTime.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)

        // Inline, human-readable lists so the summary sheet shows the actual items — not
        // just counts. Each row auto-grows in height (see addSheet) to fit these.
        const tasksList = pTasks.length
            ? pTasks
                .map(t => {
                    const due = t.due_at ? ` (due ${fmtDateShort(toDate(t.due_at))})` : ''
                    return `${t.status ?? 'To Do'} · ${t.name ?? ''}${due}`
                })
                .join('\n')
            : '—'
        const checklistList = pChecks.length
            ? pChecks.map(c => `${c.checked ? '✓' : '○'} ${c.text ?? ''}`).join('\n')
            : '—'
        return {
            name: p.name ?? '',
            event_code: p.event_code ?? '',
            stage: p.stage?.name ?? '',
            status: p.archived ? 'Archived' : 'Active',
            client: p.client?.name ?? '',
            build_type: p.build_type ?? '',
            build_addons: (p.build_addons ?? []).join(', '),
            project_type: p.project_type ?? '',
            priority: p.priority ?? '',
            stakeholder_name: p.stakeholder_name ?? '',
            stakeholder_email: p.stakeholder_email ?? '',
            build_assigned: toDate(p.start_date ?? p.build_assigned_date),
            kickoff_call_date: toDate(p.kickoff_call_date),
            web_build_start_date: toDate(p.web_build_start_date),
            first_draft_sent_date: toDate(p.first_draft_sent_date),
            build_live_date: toDate(p.due_date ?? p.build_live_date),
            tasks_list: tasksList,
            checklist_list: checklistList,
            time_logged: fmtDuration(totalSeconds),
            description: p.description ?? '',
            notes: p.notes ?? '',
        }
    })
    addSheet(wb, 'Projects', projectCols, projectRows)

    // Project name lookup for the detail sheets.
    const projectName = new Map(projects.map(p => [p.id, p.name ?? '']))

    // ── Tasks sheet ──
    const taskCols: Col[] = [
        { header: 'Project', key: 'project', width: 30 },
        { header: 'Task', key: 'name', width: 40, wrap: true },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Due', key: 'due', width: 18, numFmt: DATETIME_FMT },
        { header: 'Assignee', key: 'assignee', width: 18 },
        { header: 'Description', key: 'description', width: 40, wrap: true },
    ]
    const taskRows = projects.flatMap(p =>
        (tasksByProject.get(p.id) ?? [])
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(t => ({
                project: projectName.get(p.id) ?? '',
                name: t.name ?? '',
                status: t.status ?? '',
                due: toDate(t.due_at),
                assignee: t.assignee ?? '',
                description: t.description ?? '',
            })),
    )
    addSheet(wb, 'Tasks', taskCols, taskRows)

    // ── Checklist sheet ──
    const checkCols: Col[] = [
        { header: 'Project', key: 'project', width: 30 },
        { header: 'Checklist Item', key: 'text', width: 46, wrap: true },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Completed On', key: 'completed_on', width: 18, numFmt: DATE_FMT },
        { header: 'Completed By', key: 'completed_by', width: 20 },
    ]
    const checkRows = projects.flatMap(p =>
        (checklistByProject.get(p.id) ?? [])
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(c => ({
                project: projectName.get(p.id) ?? '',
                text: c.text ?? '',
                status: c.checked ? 'Done' : 'Pending',
                completed_on: c.checked ? toDate(c.checked_at) : null,
                completed_by: c.checked ? (c.checked_by ?? '') : '',
            })),
    )
    addSheet(wb, 'Checklist', checkCols, checkRows)

    // ── Time Log sheet ──
    const timeCols: Col[] = [
        { header: 'Project', key: 'project', width: 30 },
        { header: 'Started', key: 'started', width: 20, numFmt: DATETIME_FMT },
        { header: 'Ended', key: 'ended', width: 20, numFmt: DATETIME_FMT },
        { header: 'Duration', key: 'duration', width: 12 },
        { header: 'Tag', key: 'tag', width: 24 },
        { header: 'Notes', key: 'notes', width: 40, wrap: true },
    ]
    const timeRows = projects.flatMap(p =>
        (timeByProject.get(p.id) ?? [])
            .slice()
            .sort((a, b) => (toDate(a.started_at)?.getTime() ?? 0) - (toDate(b.started_at)?.getTime() ?? 0))
            .map(e => ({
                project: projectName.get(p.id) ?? '',
                started: toDate(e.started_at),
                ended: toDate(e.ended_at),
                duration: fmtDuration(e.duration_seconds ?? 0),
                tag: e.tag ?? '',
                notes: e.notes ?? '',
            })),
    )
    addSheet(wb, 'Time Log', timeCols, timeRows)

    // ── Notes sheet ──
    const noteCols: Col[] = [
        { header: 'Project', key: 'project', width: 30 },
        { header: 'Date', key: 'date', width: 20, numFmt: DATETIME_FMT },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Update', key: 'content', width: 60, wrap: true },
    ]
    const noteRows = projects.flatMap(p =>
        (notesByProject.get(p.id) ?? [])
            .slice()
            .sort((a, b) => (toDate(a.created_at)?.getTime() ?? 0) - (toDate(b.created_at)?.getTime() ?? 0))
            .map(n => ({
                project: projectName.get(p.id) ?? '',
                date: toDate(n.created_at),
                type: n.is_task ? 'Task' : 'Note',
                content: n.content ?? '',
            })),
    )
    addSheet(wb, 'Notes', noteCols, noteRows)

    const arrayBuffer = await wb.xlsx.writeBuffer()
    return Buffer.from(arrayBuffer)
}
