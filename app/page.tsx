import { redirect } from 'next/navigation'

// No public landing page — send everyone straight to login
export default function RootPage() {
    redirect('/login')
}
