import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [{ data: projects }, { data: stages }, { data: timeEntries }, { data: settings }] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', user.id),
        supabase.from('stages').select('*').eq('user_id', user.id).order('position'),
        supabase.from('time_entries').select('*').eq('user_id', user.id).order('started_at'),
        supabase.from('user_settings').select('monthly_target_hours').eq('id', user.id).single(),
    ])

    return (
        <ReportsClient
            projects={projects ?? []}
            stages={stages ?? []}
            timeEntries={timeEntries ?? []}
            settings={settings}
        />
    )
}
