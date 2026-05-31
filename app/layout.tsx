import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FlowDesk — Project Management for Professionals',
  description: 'A unified workspace to track projects, manage tasks with time accountability, generate progress reports, and maintain structured quality checklists before delivery.',
  keywords: ['project management', 'kanban', 'time tracking', 'task management', 'productivity'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
