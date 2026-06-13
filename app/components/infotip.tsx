'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const C = { sage:'#3D6B4F', forest:'#1E2620', stone:'#6B7066', cream:'#FAFAF5', white:'#FFFFFF' }

/** Small clickable "i" that toggles a dismissible popover.
 *  The popover is portaled to <body> with fixed positioning, so it can never be
 *  clipped or covered by an ancestor card (e.g. the calendar's overflow:hidden).
 *  Closes on outside-click, Escape, scroll, or tapping the icon again.
 *  `placement` is the preferred side ('top' default) and auto-flips if there's no room.
 *  `dark` adapts the icon for dark surfaces (e.g. the insights card). */
export default function InfoTip({ text, label, dark=false, align='center', placement='top' }:
  { text: string; label?: string; dark?: boolean; align?: 'center'|'left'; placement?: 'top'|'bottom' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left:number; top:number; side:'top'|'bottom' } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const W = 232, GAP = 9
    let side = placement
    const above = r.top, below = window.innerHeight - r.bottom
    if (side === 'top' && above < 130 && below > above) side = 'bottom'
    else if (side === 'bottom' && below < 130 && above > below) side = 'top'
    let left = r.left + r.width / 2 - W / 2
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    const top = side === 'top' ? r.top - GAP : r.bottom + GAP
    setPos({ left, top, side })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDocClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onMove = () => setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trigBorder    = dark ? 'rgba(255,255,255,0.55)' : C.stone
  const trigColor     = dark ? C.cream : C.stone
  const trigOpenBg    = dark ? C.cream : C.sage
  const trigOpenColor = dark ? C.forest : C.white
  const bubbleBg      = dark ? C.cream : C.forest
  const bubbleColor   = dark ? C.forest : C.cream

  const bubble = open && pos && typeof document !== 'undefined'
    ? createPortal(
        <span ref={popRef} role="tooltip" style={{
          position:'fixed', left:pos.left, top:pos.top,
          transform: pos.side === 'top' ? 'translateY(-100%)' : 'none',
          width:232, maxWidth:'92vw', background:bubbleBg, color:bubbleColor, fontSize:12.5,
          lineHeight:1.55, fontWeight:400, padding:'11px 13px', borderRadius:11,
          boxShadow:'0 10px 30px rgba(30,38,32,0.28)', zIndex:2147483600, textAlign:'left',
          fontFamily:"'DM Sans',sans-serif", whiteSpace:'normal' }}>
          {text}
        </span>, document.body)
    : null

  return (
    <span style={{ display:'inline-flex', verticalAlign:'middle', lineHeight:0, marginLeft:5 }}>
      <button ref={btnRef} type="button" aria-label={label||'More info'} aria-expanded={open}
        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpen(o=>!o) }}
        style={{ width:16, height:16, borderRadius:'50%', border:`1.3px solid ${open?trigOpenBg:trigBorder}`,
          background:open?trigOpenBg:'transparent', color:open?trigOpenColor:trigColor, fontSize:11, fontWeight:700,
          lineHeight:1, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
          padding:0, fontFamily:'Georgia, "Times New Roman", serif', flexShrink:0 }}>
        i
      </button>
      {bubble}
    </span>
  )
}
