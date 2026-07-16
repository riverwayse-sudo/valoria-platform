'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// /marketplace is the canonical link used everywhere — footer, 404 page,
// signup confirmation, dashboard nav — including logged-out contexts where
// we don't know the visitor's type yet. It used to hard-redirect everyone
// to /atb-connect, which put every Event Organiser looking for speakers
// straight into the talent marketplace instead of /spotlight (ATB Spotlight).
export default function MarketplacePage() {
  const router = useRouter()

  useEffect(() => {
    async function route() {
      const { data: { user } } = await supabase.auth.getUser()

      // Logged out (public/marketing traffic) — ATB Connect is the right
      // default landing surface, same as the previous behavior.
      if (!user) { router.replace('/atb-connect'); return }

      // Only buyers (profiles table) carry a distinguishing user_type of
      // 'organiser' vs 'employer'. Professionals (professional_profiles)
      // and employers both land on ATB Connect.
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle()

      router.replace(buyerProfile?.user_type === 'organiser' ? '/spotlight' : '/atb-connect')
    }
    route()
  }, [router])

  return null
}
