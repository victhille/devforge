import { useMemo } from 'react'
import { encode } from 'uqr'

/**
 * A QR code drawn from its text, in the page (no image to fetch, nothing sent anywhere):
 * dark modules on a white ground with a quiet zone, whatever the theme, so a camera reads it.
 */
export default function QrCode({ text, label, size = 208 }: { text: string; label: string; size?: number }) {
  const { path, n } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`
      })
    )
    return { path: d, n: qr.size }
  }, [text])
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" className="rounded-control">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={path} fill="#111111" />
    </svg>
  )
}
