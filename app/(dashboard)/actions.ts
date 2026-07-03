'use server'

import { createClient } from '@/lib/supabase/server'

export async function setProjectArchived(projectId: string, archived: boolean): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('projects')
        .update({ archived })
        .eq('id', projectId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}

export async function updateProjectStage(
    projectId: string,
    stageId: string,
    changedAt: string
): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('projects')
        .update({ stage_id: stageId, stage_changed_at: changedAt })
        .eq('id', projectId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}

export async function updateProjectDates(
    projectId: string,
    dates: Record<string, string>
): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('projects')
        .update(dates)
        .eq('id', projectId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}

export async function updateProjectDetails(
    projectId: string,
    fields: Record<string, unknown>
): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('projects')
        .update(fields)
        .eq('id', projectId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}

// ── Task (action item) mutations ──
// Routed through server actions like the project mutations above, so the write
// runs server-side and avoids browser CORS/"Failed to fetch" failures on PATCH/POST/DELETE.

export async function createTask(
    projectId: string,
    fields: { name: string; position: number; due_at: string | null; due_has_time: boolean }
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            project_id: projectId,
            user_id: user.id,
            name: fields.name,
            status: 'To Do',
            position: fields.position,
            due_at: fields.due_at,
            due_has_time: fields.due_has_time,
        })
        .select()
        .single()

    return { data: data ?? null, error: error?.message ?? null }
}

export async function updateTaskStatus(
    taskId: string,
    status: string
): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id)

    return { error: error?.message ?? null }
}
