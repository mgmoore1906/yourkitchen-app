'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KitchenSetupRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/onboarding') }, [router])
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: '#6B7066', fontSize: 14 }}>Taking you to setup…</p>
    </div>
  )
}
