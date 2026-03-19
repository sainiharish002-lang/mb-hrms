'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .single()

      if (!profile || profile.status === 'pending' || profile.status === 'inactive') {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      if (profile.role === 'admin') router.push('/dashboard')
      else router.push('/employee/dashboard')
    }
    check()
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div>Loading...</div>
    </div>
  )
}