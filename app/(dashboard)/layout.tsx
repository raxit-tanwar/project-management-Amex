import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimerProvider } from '@/context/TimerContext'
import Sidebar from '@/components/ui/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Only fetch profile — no project fetch here (was leftover from removed GlobalTimerBar)
    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()

    return (
        <TimerProvider>
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
                <Sidebar
                    user={{
                        email: user.email ?? '',
                        name: profile?.display_name ?? user.email?.split('@')[0] ?? 'User'
                    }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <main style={{ flex: 1, overflow: 'auto', position: 'relative', background: 'var(--bg)' }}>
                        {children}
                    </main>
                </div>
            </div>
        </TimerProvider>
    )
}
