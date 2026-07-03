'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '../actions'

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function clientAction(formData: FormData) {
        setLoading(true)
        setError(null)
        const result = await login(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Welcome back
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                    Sign in to your FlowDesk workspace.
                </p>
            </div>

            <form action={clientAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                    <label className="label" htmlFor="email">Email address</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="input"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                        <Link href="/reset-password" style={{ fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}>
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="input"
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div style={{
                        padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--danger)', fontSize: 13, fontWeight: 500
                    }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 4, height: 44 }}
                >
                    {loading ? <span className="spinner" /> : 'Sign in'}
                </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                Don&apos;t have an account?{' '}
                <Link href="/signup" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>
                    Create one free
                </Link>
            </p>
        </div>
    )
}
