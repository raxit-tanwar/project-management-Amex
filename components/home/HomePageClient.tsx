'use client'

import BoardClient from '@/components/board/BoardClient'

interface Stage { id: string; name: string; color: string; position: number }
interface Client { id: string; name: string }
interface Project {
    id: string; name: string; event_code?: string; stage_id?: string
    stage?: Stage | null; tasks?: { id: string; name: string }[]
    checklist_items?: { id: string; checked: boolean; text: string; position: number }[]
    time_entries?: { duration_seconds: number; started_at: string }[]
    [key: string]: unknown
}

interface HomePageClientProps {
    userId: string
    userDisplayName?: string
    initialProjects: Project[]
    initialStages: Stage[]
    initialClients: Client[]
}

export default function HomePageClient({ userId, userDisplayName, initialProjects, initialStages, initialClients }: HomePageClientProps) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
                        Good {greeting}, {userDisplayName || 'there'} 👋
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <BoardClient
                    userId={userId}
                    userDisplayName={userDisplayName}
                    initialStages={initialStages as unknown as Parameters<typeof BoardClient>[0]['initialStages']}
                    initialProjects={initialProjects as unknown as Parameters<typeof BoardClient>[0]['initialProjects']}
                    initialClients={initialClients}
                    embedded={true}
                />
            </div>
        </div>
    )
}
