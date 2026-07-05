'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    try {
        const supabase = await createClient()

        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        const { error } = await supabase.auth.signInWithPassword(data)

        if (error) {
            return { error: error.message }
        }

        revalidatePath('/', 'layout')
        redirect('/dashboard')
    } catch (err) {
        // redirect() throws a NEXT_REDIRECT error that must be allowed to propagate.
        if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
        return { error: 'An unexpected error occurred during login. Please try again.' }
    }
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        options: {
            data: {
                full_name: formData.get('full_name') as string,
            },
        },
    }

    const { error } = await supabase.auth.signUp(data)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function signout() {
    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
        redirect('/login')
    } catch (err) {
        if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
        redirect('/login')
    }
}

export async function resetPassword(formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

// Completes the password-reset flow. The user reaches /update-password already
// authenticated (the reset link exchanges its code for a session in /auth/callback),
// so we set the new password on the current session's user.
export async function updatePassword(formData: FormData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Your reset link is invalid or has expired. Please request a new one.' }
    }

    const password = formData.get('password') as string
    if (!password || password.length < 8) {
        return { error: 'Password must be at least 8 characters.' }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
