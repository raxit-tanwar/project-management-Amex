import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OverviewClient from '@/components/home/OverviewClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [{ data: profile }, { data: stages }, { data: projects }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('stages').select('*').eq('user_id', user.id).order('position'),
        supabase.from('projects').select(`
            id, name, event_code, due_date, stage_id,
            stage:stages(id, name, color),
            client:clients(name),
            tasks(id, status, name, due_at, due_has_time)
        `).eq('user_id', user.id).eq('archived', false).order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('user_settings').select('build_notes').eq('id', user.id).single(),
    ])

    return (
        <OverviewClient
            userDisplayName={profile?.display_name || user.email?.split('@')[0]}
            initialStages={stages ?? []}
            initialProjects={(projects ?? []) as unknown as Parameters<typeof OverviewClient>[0]['initialProjects']}
            buildNotes={settings?.build_notes ?? ''}
        />
    )
}
