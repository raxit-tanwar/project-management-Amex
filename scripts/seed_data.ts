
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for seeding

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('🌱 Seeding dummy data...')

  // 1. Get a user
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
  if (userError || !users.length) {
    console.error('No users found to seed data for', userError)
    return
  }
  const userId = users[0].id
  console.log(`Using user: ${users[0].email} (${userId})`)

  // 2. Get stages
  const { data: stages } = await supabase.from('stages').select('*').order('position')
  if (!stages?.length) {
    console.error('No stages found')
    return
  }

  // 3. Create a client if none exist
  let clientId;
  const { data: clients } = await supabase.from('clients').select('id').limit(1)
  if (!clients?.length) {
    const { data: newClient } = await supabase.from('clients').insert({
      name: 'Acme Corp',
      user_id: userId
    }).select().single()
    clientId = newClient.id
  } else {
    clientId = clients[0].id
  }

  // 4. Create projects for "Yesterday"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayISO = yesterday.toISOString()

  const projectsToCreate = [
    { 
      name: 'Legacy Migration', 
      event_code: 'EVT-001', 
      client_id: clientId, 
      user_id: userId, 
      stage_id: stages[1].id, // In Progress
      priority: 'High',
      start_date: yesterdayISO.split('T')[0]
    },
    { 
      name: 'UI Refinement', 
      event_code: 'EVT-002', 
      client_id: clientId, 
      user_id: userId, 
      stage_id: stages[1].id, 
      priority: 'Medium',
      start_date: yesterdayISO.split('T')[0]
    }
  ]

  const { data: createdProjects, error: projError } = await supabase.from('projects').insert(projectsToCreate).select()
  if (projError) {
    console.error('Error creating projects', projError)
    return
  }
  console.log('Created projects for yesterday')

  // 5. Create time entries for "Yesterday"
  for (const p of createdProjects) {
    // Create few entries for yesterday
    const { error: timeError } = await supabase.from('time_entries').insert([
      {
        project_id: p.id,
        user_id: userId,
        started_at: `${yesterdayISO.split('T')[0]}T10:00:00Z`,
        duration_seconds: 3600 * 2, // 2 hours
        description: 'Working on core logic'
      },
      {
        project_id: p.id,
        user_id: userId,
        started_at: `${yesterdayISO.split('T')[0]}T14:30:00Z`,
        duration_seconds: 1800, // 30 mins
        description: 'Debugging layout issues'
      }
    ])
    if (timeError) console.error('Error seeding time entries', timeError)
  }

  // 6. Create time entries for "Last Week" for reports
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 5)
  const lastWeekStr = lastWeek.toISOString().split('T')[0]

  if (createdProjects[0]) {
    await supabase.from('time_entries').insert({
      project_id: createdProjects[0].id,
      user_id: userId,
      started_at: `${lastWeekStr}T09:00:00Z`,
      duration_seconds: 3600 * 4, // 4 hours
      description: 'Historical data'
    })
  }

  console.log('✅ Seeding complete!')
}

seed().catch(console.error)
