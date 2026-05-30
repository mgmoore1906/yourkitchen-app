// lib/distance.ts — haversine distance + tip logic

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R     = 3958.8 // Earth radius in miles
  const dLat  = (lat2 - lat1) * Math.PI / 180
  const dLng  = (lng2 - lng1) * Math.PI / 180
  const a     = Math.sin(dLat/2)**2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export type TipTier = {
  default:  number   // default tip in cents
  options:  { label: string; value: number }[]
  warning?: string
  badge:    { text: string; color: string; bg: string }
}

export function getTipTier(miles: number): TipTier {
  if (miles < 4) return {
    default: 300,
    options: [{ label:'No tip',value:0},{ label:'$2',value:200},{ label:'$3',value:300},{ label:'$5',value:500}],
    badge: { text: `${miles.toFixed(1)} mi`, color: '#276749', bg: '#E6F7EF' },
  }
  if (miles < 7) return {
    default: 400,
    options: [{ label:'No tip',value:0},{ label:'$3',value:300},{ label:'$4',value:400},{ label:'$5',value:500},{ label:'$6',value:600}],
    badge: { text: `${miles.toFixed(1)} mi`, color: '#276749', bg: '#E6F7EF' },
  }
  if (miles < 10) return {
    default: 600,
    options: [{ label:'No tip',value:0},{ label:'$4',value:400},{ label:'$5',value:500},{ label:'$6',value:600},{ label:'$8',value:800}],
    warning: `🟡 ${miles.toFixed(1)} miles — a $6+ tip helps ensure quick pickup`,
    badge: { text: `${miles.toFixed(1)} mi`, color: '#7A5800', bg: '#FFF8E8' },
  }
  return {
    default: 800,
    options: [{ label:'No tip',value:0},{ label:'$5',value:500},{ label:'$6',value:600},{ label:'$8',value:800},{ label:'$10',value:1000}],
    warning: `🔴 ${miles.toFixed(1)} miles — a $8+ tip is strongly recommended for reliable delivery`,
    badge: { text: `${miles.toFixed(1)} mi`, color: '#B94040', bg: '#FDE8E8' },
  }
}

export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`
}
