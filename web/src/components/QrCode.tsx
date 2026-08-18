import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Los códigos de emparejamiento directo son largos (llevan dentro la
 * descripción de sesión), así que se usa el nivel de corrección más bajo:
 * cabe más información y la cámara de un teléfono lo lee sin problema.
 */
export function QrCode({ value, size = 640 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    setError(null)
    const canvas = ref.current
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'L',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => {
        // La librería fija el tamaño en el propio elemento; se le quita para
        // que mande el CSS y el código se adapte al ancho de la pantalla.
        canvas.style.width = '100%'
        canvas.style.height = 'auto'
      })
      .catch(() => setError('El código es demasiado largo para un QR'))
  }, [value, size])

  if (error) return <div className="muted">{error}</div>

  // Los códigos de enlace directo son densos: se pintan a resolución alta y se
  // escalan por CSS al ancho disponible, para que la otra cámara los lea bien.
  return (
    <div className="qr qr-auto">
      <canvas ref={ref} />
    </div>
  )
}
