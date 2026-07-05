'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updatePassword } from '../actions'

export default function UpdatePasswordPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setError(null)
        const password = (formData.get('password') as string) ?? ''
        const confirm = (formData.get('confirm') as string) ?? ''

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)
        const result = await updatePassword(formData)
        // On success the action redirects to /dashboard; only errors return here.
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Set a new password
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                    Choose a new password for your FlowDesk account.
                </p>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                    <label className="label" htmlFor="password">New password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="input"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label className="label" htmlFor="confirm">Confirm new password</label>
                    <input
                        id="confirm"
                        name="confirm"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
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
                    style={{ width: '100%', height: 44 }}
                >
                    {loading ? <span className="spinner" /> : 'Update password'}
                </button>

                <Link href="/login" style={{
                    textAlign: 'center', fontSize: 14, color: 'var(--text-muted)',
                    textDecoration: 'none', fontWeight: 500
                }}>
                    ← Back to sign in
                </Link>
            </form>
        </div>
    )
}
