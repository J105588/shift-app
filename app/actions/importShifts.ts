'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxhimoxs7znRwxl12naHjQjSYcRMFTFWS1Z5HFOAWqgJkWpr4mKvFBZ-u0SGMafcn2V/exec'

export async function importShifts(dateStr: string) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.set({ name, value: '', ...options })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, errors: ['Not authenticated'] }
    }

    // Check if admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        return { success: false, errors: ['Unauthorized'] }
    }

    try {
        // 1. Fetch JSON from GAS
        const response = await fetch(GAS_URL)
        const json = await response.json()

        if (json.status !== 'success' || !Array.isArray(json.data)) {
            return { success: false, errors: ['Invalid data format from GAS'] }
        }

        const membersData = json.data
        const errors: string[] = []
        const newShifts: any[] = []

        // 2. Fetch all profiles for name matching
        const { data: allProfiles } = await supabase.from('profiles').select('id, display_name')
        if (!allProfiles) {
            return { success: false, errors: ['Failed to load profiles'] }
        }

        const profileMap = new Map()
        allProfiles.forEach((p: any) => {
            if (p.display_name) {
                profileMap.set(p.display_name.trim(), p.id)
            }
        })

        // 3. Process data
        for (const item of membersData) {
            const memberName = item.member
            const userId = profileMap.get(memberName.trim())

            if (!userId) {
                errors.push(`User not found: ${memberName}`)
                continue
            }

            const memberShifts = item.shifts
            if (Array.isArray(memberShifts)) {
                for (const s of memberShifts) {
                    // Combine date and time
                    // dateStr is YYYY-MM-DD, startTime is HH:MM

                    const startDateTime = new Date(`${dateStr}T${s.startTime}:00`)
                    const endDateTime = new Date(`${dateStr}T${s.endTime}:00`)

                    // Handle crossing midnight if needed? Assumed within same day for now based on context, 
                    // but if end < start, maybe it's next day. Let's assume same day for simplicity unless logic demands otherwise.
                    // Actually, the example shows "08:30" to "16:00", standard day shifts.

                    newShifts.push({
                        user_id: userId,
                        title: s.task,
                        start_time: startDateTime.toISOString(),
                        end_time: endDateTime.toISOString(),
                    })
                }
            }
        }

        // 4. Insert shifts
        if (newShifts.length > 0) {
            const { error } = await supabase.from('shifts').insert(newShifts)
            if (error) {
                console.error(error)
                return { success: false, errors: [...errors, `Database Insert Error: ${error.message}`] }
            }
        }

        revalidatePath('/admin')
        return { success: true, count: newShifts.length, errors }

    } catch (error: any) {
        console.error(error)
        return { success: false, errors: [`System Error: ${error.message}`] }
    }
}
