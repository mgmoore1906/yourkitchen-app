'use client'
import { useState, useRef, useEffect } from 'react'

const C = { sage:'#3D6B4F', forest:'#1E2620', stone:'#6B7066', cream:'#FAFAF5', white:'#FFFFFF' }

/** Small clickable "i" that toggles a dismissible popover.
 *  Closes on outside-click, Escape, or tapping the icon again.
 *  Pass `dark` when sitting on a dark surface (e.g. the insights card). */
export default function InfoTip({ text, label, dark=false, align='center' }:
  { text: string; label?: string; dark?: boolean; align?: 'center'|'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const trigBorder    = dark ? 'rgba(255,255,255,0.55)' : C.stone
  const trigColor     = dark ? C.cream : C.stone
  const trigOpenBg    = dark ? C.cream : C.sage
  const trigOpenColor = dark ? C.forest : C.white
  const bubbleBg      = dark ? C.cream : C.forest
  const bubbleColor   = dark ? C.forest : C.cream

  return (
    <span ref={ref} style={{ position:'relative', display:'inline-flex', verticalAlign:'middle', lineHeight:0, marginLeft:5 }}>
      <button type="button" aria-label={label||'More info'} aria-expanded={open}
        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpen(o=>!o) }}
        style={{ width:16, height:16, borderRadius:'50%', border:`1.3px solid ${open?trigOpenBg:trigBorder}`,
          background:open?trigOpenBg:'transparent', color:open?trigOpenColor:trigColor, fontSize:11, fontWeight:700,
          lineHeight:1, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
          padding:0, fontFamily:'Georgia, "Times New Roman", serif', flexShrink:0 }}>
        i
      </button>
      {open && (
        <span role="tooltip" style={{ position:'absolute', bottom:'calc(100% + 9px)',
          left: align==='left' ? '0' : '50%', transform: align==='left' ? 'none' : 'translateX(-50%)',
          width:232, maxWidth:'72vw', background:bubbleBg, color:bubbleColor, fontSize:12.5, lineHeight:1.55,
          fontWeight:400, padding:'11px 13px', borderRadius:11, boxShadow:'0 10px 30px rgba(30,38,32,0.28)',
          zIndex:200, textAlign:'left', fontFamily:"'DM Sans',sans-serif", whiteSpace:'normal' }}>
          {text}
          <span style={{ position:'absolute', top:'100%', left: align==='left' ? '14px' : '50%',
            transform: align==='left' ? 'none' : 'translateX(-50%)', width:0, height:0,
            borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:`6px solid ${bubbleBg}` }}/>
        </span>
      )}
    </span>
  )
}
