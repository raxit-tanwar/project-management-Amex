'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div className="gradient-mesh" />

      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(10,10,15,0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
          }}>⚡</div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            Flow<span style={{ color: 'var(--accent-light)' }}>Desk</span>
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href="#features" style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            Features
          </a>
          <a href="#how-it-works" style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            How it works
          </a>
          <Link href="/login" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}>Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm" style={{ marginLeft: 4 }}>Get started free</Link>
        </nav>
      </header>

      {/* HERO */}
      <section style={{
        paddingTop: 160, paddingBottom: 100, textAlign: 'center',
        position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '160px 24px 100px'
      }}>
        <div className="fade-in" style={{ animationDelay: '0s' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 100,
            background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
            fontSize: 13, fontWeight: 600, color: 'var(--accent-light)',
            marginBottom: 32, letterSpacing: '0.02em'
          }}>
            ✦ Project Management Reimagined
          </div>
        </div>

        <h1 className="fade-in" style={{
          fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 900,
          letterSpacing: '-0.04em', lineHeight: 1.05,
          marginBottom: 24, animationDelay: '0.1s',
          background: 'linear-gradient(135deg, #e8e8f0 0%, #a8a8c8 60%, #6366f1 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          Your projects.<br />Your time.<br />One desk.
        </h1>

        <p className="fade-in" style={{
          fontSize: 18, color: 'var(--text-muted)', lineHeight: 1.7,
          maxWidth: 560, margin: '0 auto 48px', animationDelay: '0.2s'
        }}>
          FlowDesk unifies your Kanban board, time tracking, quality checklists, and reports into one seamless workspace — built for professionals who ship great work.
        </p>

        <div className="fade-in" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animationDelay: '0.3s' }}>
          <Link href="/signup" className="btn btn-primary btn-lg" style={{ minWidth: 180 }}>
            Start for free →
          </Link>
          <a href="#features" className="btn btn-ghost btn-lg">
            Explore features
          </a>
        </div>

        {/* Hero visual */}
        <div className="fade-in" style={{ marginTop: 80, position: 'relative', animationDelay: '0.4s' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          }}>
            {/* Mock app topbar */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {['Board', 'Reports', 'Settings'].map(item => (
                  <span key={item} style={{ fontSize: 13, color: item === 'Board' ? 'var(--accent-light)' : 'var(--text-muted)', fontWeight: 600 }}>{item}</span>
                ))}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>▶ 01:23:45</span>
              </div>
            </div>

            {/* Mock Kanban */}
            <div style={{ display: 'flex', gap: 16, padding: 20, overflowX: 'auto', minHeight: 280 }}>
              {[
                { name: 'Backlog', color: '#64748b', cards: ['Website Redesign', 'API Integration'] },
                { name: 'In Progress', color: '#6366f1', cards: ['Mobile App UI', 'Dashboard Charts'] },
                { name: 'In Review', color: '#f59e0b', cards: ['Brand Guidelines'] },
                { name: 'Done', color: '#22c55e', cards: ['Logo Design'] },
              ].map(col => (
                <div key={col.name} style={{ minWidth: 200, flex: '0 0 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {col.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{col.cards.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {col.cards.map(card => (
                      <div key={card} style={{
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '10px 12px',
                        borderLeft: `3px solid ${col.color}`
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{card}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⏱ 2h 30m</span>
                          <span style={{ fontSize: 10, color: 'var(--success)' }}>4/6 ✓</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating timer */}
          <div style={{
            position: 'absolute', bottom: -20, right: 40,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '12px 16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14
            }}>⏱</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Mobile App UI</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', letterSpacing: '0.02em', fontFamily: 'monospace' }}>01:23:45</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 12, color: 'var(--warning)'
            }}>⏸</div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '60px 40px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, textAlign: 'center' }}>
          {[
            { value: '<60s', label: 'To create a project' },
            { value: '5', label: 'Built-in pipeline stages' },
            { value: '4', label: 'Report types' },
            { value: '100%', label: 'Cloud-persisted data' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--accent-light)', marginBottom: 6 }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '100px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 14px', borderRadius: 100,
              background: 'var(--accent-dim2)', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20
            }}>Features</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
              Everything you need, nothing you don&apos;t.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto' }}>
              Stop juggling between apps. FlowDesk brings your entire workflow into one premium, focused workspace.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              {
                icon: '⚡',
                title: 'Visual Kanban Board',
                desc: 'Drag-and-drop project cards across customizable pipeline stages. Filter, sort, and switch between board and list view — all in one glance.',
                color: '#6366f1',
                tags: ['Drag & Drop', 'Custom Stages', 'Filters'],
              },
              {
                icon: '⏱',
                title: 'Built-in Time Tracker',
                desc: 'A persistent, floating timer widget that logs time against any task or project. Daily summaries, time-per-project breakdowns, and session history.',
                color: '#22c55e',
                tags: ['Live Timer', 'Daily Summary', 'Session Log'],
              },
              {
                icon: '✅',
                title: 'Quality Checklists',
                desc: 'Pre-dispatch checklist tied to every project. Customizable, templated, and progress-tracked directly on each project card.',
                color: '#f59e0b',
                tags: ['Templates', 'Progress Ring', 'Per-Project'],
              },
              {
                icon: '📊',
                title: 'Actionable Reports',
                desc: 'Four built-in reports: Project Status, Time, Stage Movement, and Checklist Compliance. Visual charts with CSV export.',
                color: '#3b82f6',
                tags: ['4 Report Types', 'Charts', 'CSV Export'],
              },
              {
                icon: '📋',
                title: 'Task Management',
                desc: 'Break projects into tasks with estimated vs. actual time, status tracking, and direct timer attachment per task.',
                color: '#8b5cf6',
                tags: ['Task Timer', 'Status', 'Estimated Time'],
              },
              {
                icon: '⚙️',
                title: 'Fully Configurable',
                desc: 'Rename stages, reorder pipeline columns, set default checklists, configure work hours, and export all your data anytime.',
                color: '#ef4444',
                tags: ['Stage Editor', 'Preferences', 'Data Export'],
              },
            ].map(feature => (
              <div key={feature.title} className="card" style={{
                padding: 28, position: 'relative', overflow: 'hidden',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'default'
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
                    ; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    ; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${feature.color}, transparent)`,
                  opacity: 0.6
                }} />
                <div style={{
                  width: 48, height: 48, borderRadius: 12, fontSize: 24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${feature.color}18`, border: `1px solid ${feature.color}30`,
                  marginBottom: 16
                }}>{feature.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>{feature.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 16 }}>{feature.desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {feature.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '3px 9px', borderRadius: 6,
                      background: `${feature.color}12`, border: `1px solid ${feature.color}20`,
                      fontSize: 11, fontWeight: 600, color: feature.color
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{
        padding: '100px 40px', position: 'relative', zIndex: 1,
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 14px', borderRadius: 100,
            background: 'var(--accent-dim2)', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20
          }}>How it works</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 64 }}>
            Up and running in minutes.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                step: '01',
                title: 'Create your account',
                desc: 'Sign up in seconds. Your account comes pre-loaded with a default Kanban pipeline, a quality checklist template, and all settings configured.',
              },
              {
                step: '02',
                title: 'Add your projects',
                desc: 'Create project cards with names, clients, priorities, and due dates. The board organises them into pipeline stages automatically.',
              },
              {
                step: '03',
                title: 'Track, check, ship.',
                desc: 'Start the built-in timer as you work, tick off your quality checklist before sending, and view reports to understand where your time went.',
              },
            ].map((item, i) => (
              <div key={item.step} style={{
                display: 'flex', gap: 32, alignItems: 'flex-start',
                textAlign: 'left', padding: '40px 0',
                borderBottom: i < 2 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{
                  flex: '0 0 56px', width: 56, height: 56, borderRadius: 16,
                  background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 900, color: 'var(--accent-light)',
                  letterSpacing: '0.02em'
                }}>{item.step}</div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>{item.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '100px 40px', position: 'relative', zIndex: 1,
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{
          maxWidth: 700, margin: '0 auto', textAlign: 'center',
          padding: 60, borderRadius: 24,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 80px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)'
          }} />
          <div style={{ fontSize: 40, marginBottom: 20 }}>⚡</div>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Ready to take control of your workflow?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 40, lineHeight: 1.7 }}>
            Join professionals who track projects, log time, and ship quality work — all in one place. Free to get started.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg" style={{ minWidth: 200 }}>
            Create free account →
          </Link>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 16 }}>
            No credit card required · Free forever for individuals
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: '40px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
          }}>⚡</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>FlowDesk</span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          © {new Date().getFullYear()} FlowDesk. Built for professionals.
        </span>
      </footer>
    </div>
  )
}
