'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { resetPassword } from '../actions'

export default function ResetPasswordPage() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        const result = await resetPassword(formData)
        if (result?.error) {
            setError(result.error)
        } else {
            setSuccess(true)
        }
        setLoading(false)
    }

    return (
        <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Reset your password
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                    Enter your email and we&apos;ll send you a reset link.
                </p>
            </div>

            {success ? (
                <div style={{
                    padding: '24px', borderRadius: 'var(--radius-lg)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-xs)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: '50%', margin: '0 auto 14px',
                        background: 'rgba(22,163,74,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <MailCheck size={20} color="var(--success)" />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Check your inbox</div>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        We&apos;ve sent a password reset link to your email address. Click the link to set a new password.
                    </p>
                    <Link href="/login" className="btn btn-surface btn-sm" style={{ display: 'inline-flex', marginTop: 20 }}>
                        ← Back to sign in
                    </Link>
                </div>
            ) : (
                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                        {loading ? <span className="spinner" /> : 'Send reset link'}
                    </button>

                    <Link href="/login" style={{
                        textAlign: 'center', fontSize: 14, color: 'var(--text-muted)',
                        textDecoration: 'none', fontWeight: 500
                    }}>
                        ← Back to sign in
                    </Link>
                </form>
            )}
        </div>
    )
}
