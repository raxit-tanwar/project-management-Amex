'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '../actions'

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        const password = formData.get('password') as string
        const confirm = formData.get('confirm_password') as string
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        setLoading(true)
        setError(null)
        const result = await signup(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Create your account
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                    Free forever for individuals. No credit card needed.
                </p>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                    <label className="label" htmlFor="full_name">Full name</label>
                    <input
                        id="full_name"
                        name="full_name"
                        type="text"
                        autoComplete="name"
                        required
                        className="input"
                        placeholder="Alex Johnson"
                    />
                </div>

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
                    <label className="label" htmlFor="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="input"
                        placeholder="Min. 8 characters"
                    />
                </div>

                <div>
                    <label className="label" htmlFor="confirm_password">Confirm password</label>
                    <input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        autoComplete="new-password"
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
                        ⚠ {error}
                    </div>
                )}

                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    By creating an account you agree to our{' '}
                    <span style={{ color: 'var(--text-muted)' }}>Terms of Service</span>{' '}
                    and{' '}
                    <span style={{ color: 'var(--text-muted)' }}>Privacy Policy</span>.
                </p>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', height: 44 }}
                >
                    {loading ? <span className="spinner" /> : 'Create account →'}
                </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 24 }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>
                    Sign in
                </Link>
            </p>
        </div>
    )
}
