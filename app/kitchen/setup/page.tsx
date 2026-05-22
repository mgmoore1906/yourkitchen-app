'use client'
import { useRouter } from 'next/navigation'
export default function KitchenSetupPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 18, color: '#1E2620' }}>Kitchen setup — coming next</p>
      <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', background: '#3D6B4F', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 14 }}>← Back to Dashboard</button>
    </div>
  )
}
