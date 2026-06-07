import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TimeTrackerClient from '@/components/timer/TimeTrackerClient'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ data: profile }, { data: projects }, { data: timeEntries }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('projects')
            .select('id, name, event_code, stage:stages(id, name, color), tasks(id, name)')
            .eq('user_id', user.id)
            .eq('archived', false)
            .order('name'),
        supabase.from('time_entries')
            .select('id, started_at, ended_at, duration_seconds, notes, project_id, task_id, project:projects(id, name, event_code, stage:stages(name, color))')
            .eq('user_id', user.id)
            .gte('started_at', sevenDaysAgo.toISOString())
            .order('started_at', { ascending: false })
    ])

    return (
        <TimeTrackerClient
            userId={user.id}
            userDisplayName={profile?.display_name || user.email?.split('@')[0]}
            initialProjects={(projects ?? []) as unknown as Parameters<typeof TimeTrackerClient>[0]['initialProjects']}
            initialTimeEntries={(timeEntries ?? []) as unknown as Parameters<typeof TimeTrackerClient>[0]['initialTimeEntries']}
        />
    )
}
