import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomePageClient from '@/components/home/HomePageClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ data: profile }, { data: stages }, { data: projects }, { data: clients }, { data: timeEntries }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('stages').select('*').eq('user_id', user.id).order('position'),
        supabase.from('projects').select(`
            *,
            stage:stages(id, name, color),
            tasks(id, status, name, estimated_minutes),
            checklist_items(id, checked, text, position),
            time_entries(duration_seconds, started_at)
        `).eq('user_id', user.id).eq('archived', false).order('created_at', { ascending: false }),
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
        supabase.from('time_entries')
            .select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))')
            .eq('user_id', user.id)
            .gte('started_at', sevenDaysAgo.toISOString())
            .order('started_at', { ascending: false }),
    ])

    return (
        <HomePageClient
            userId={user.id}
            userDisplayName={profile?.display_name || user.email?.split('@')[0]}
            initialProjects={(projects ?? []) as unknown as Parameters<typeof HomePageClient>[0]['initialProjects']}
            initialTimeEntries={(timeEntries ?? []) as unknown as Parameters<typeof HomePageClient>[0]['initialTimeEntries']}
            initialStages={(stages ?? []) as unknown as Parameters<typeof HomePageClient>[0]['initialStages']}
            initialClients={clients ?? []}
        />
    )
}
