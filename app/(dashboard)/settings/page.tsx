import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [{ data: stages }, { data: templates }, { data: settings }, { data: clients }] = await Promise.all([
        supabase.from('stages').select('*').eq('user_id', user.id).order('position'),
        supabase.from('checklist_templates').select('*').eq('user_id', user.id).order('position'),
        supabase.from('user_settings').select('*').eq('id', user.id).single(),
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
    ])

    return (
        <SettingsClient
            userId={user.id}
            initialStages={stages ?? []}
            initialTemplates={templates ?? []}
            initialSettings={settings}
            initialClients={clients ?? []}
        />
    )
}
