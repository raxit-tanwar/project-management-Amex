import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProjectsWorkbook } from '@/lib/export/projectWorkbook'

// exceljs needs the Node runtime; force-dynamic because the response depends on the user.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PROJECTS = 500

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const rawIds = (body as { projectIds?: unknown })?.projectIds
    const projectIds = Array.isArray(rawIds)
        ? [...new Set(rawIds.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_PROJECTS)
        : []

    if (projectIds.length === 0) {
        return NextResponse.json({ error: 'Select at least one project to export.' }, { status: 400 })
    }

    // Fetch only the caller's own projects (explicit user_id filter + RLS) that were selected.
    const { data: projects, error: projErr } = await supabase
        .from('projects')
        .select('*, stage:stages(name, color), client:clients(name)')
        .eq('user_id', user.id)
        .in('id', projectIds)
        .order('created_at', { ascending: false })

    if (projErr) {
        return NextResponse.json({ error: projErr.message }, { status: 500 })
    }
    if (!projects || projects.length === 0) {
        return NextResponse.json({ error: 'No matching projects found.' }, { status: 404 })
    }

    const ids = projects.map(p => p.id)
    const [{ data: tasks }, { data: checklist }, { data: timeEntries }, { data: notes }] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id).in('project_id', ids),
        supabase.from('checklist_items').select('*').eq('user_id', user.id).in('project_id', ids),
        supabase.from('time_entries').select('*').eq('user_id', user.id).in('project_id', ids),
        supabase.from('project_notes_log').select('*').eq('user_id', user.id).in('project_id', ids),
    ])

    const buffer = await buildProjectsWorkbook({
        projects,
        tasks: tasks ?? [],
        checklist: checklist ?? [],
        timeEntries: timeEntries ?? [],
        notes: notes ?? [],
    })

    const filename = `FlowDesk_Projects_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'no-store',
        },
    })
}
