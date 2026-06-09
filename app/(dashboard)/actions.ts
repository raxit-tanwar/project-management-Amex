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
