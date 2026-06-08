import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BoardClient from '@/components/board/BoardClient'

export const dynamic = 'force-dynamic'

export default async function BoardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [{ data: profile }, { data: stages }, { data: projects }, { data: clients }] = await Promise.all([
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
    ])

    return (
        <BoardClient
            userId={user.id}
            userDisplayName={profile?.display_name || user.email?.split('@')[0]}
            initialStages={stages ?? []}
            initialProjects={projects ?? []}
            initialClients={clients ?? []}
        />
    )
}
