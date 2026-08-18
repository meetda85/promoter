import { useEffect, useRef, useState } from 'react'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike
  }
}

/**
 * Lector de QR a pantalla completa.
 *
 * Usa el detector nativo del sistema cuando existe (Android) y cae en un
 * decodificador en JavaScript cuando no (Safari), que se carga sólo al abrir
 * la cámara para no engordar el arranque de la app.
 */
export function QrScanner({
  title,
  hint,
  onResult,
  onClose,
}: {
  title: string
  hint?: string
  onResult: (text: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const canvas = document.createElement('canvas')

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        setError(
          window.isSecureContext
            ? 'No se pudo abrir la cámara. Revisa el permiso de cámara para esta app.'
            : 'La cámara sólo funciona en direcciones seguras (https). Usa el emparejamiento por código pegado.',
        )
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play().catch(() => undefined)

      const native = window.BarcodeDetector
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null
      const jsQR = native ? null : (await import('jsqr')).default

      const tick = async () => {
        if (stopped) return
        raf = requestAnimationFrame(() => void tick())

        if (video.readyState !== video.HAVE_ENOUGH_DATA) return
        try {
          if (native) {
            const found = await native.detect(video)
            if (found.length && found[0].rawValue) finish(found[0].rawValue)
            return
          }
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return
          ctx.drawImage(video, 0, 0)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const found = jsQR!(image.data, image.width, image.height)
          if (found?.data) finish(found.data)
        } catch {
          /* fotograma ilegible: se prueba con el siguiente */
        }
      }

      const finish = (text: string) => {
        if (stopped) return
        stopped = true
        try {
          navigator.vibrate?.(20)
        } catch {
          /* sin vibración: da igual */
        }
        onResult(text)
      }

      void tick()
    }

    void run()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      <div className="scanner-frame" />
      <div className="scanner-bar">
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{title}</div>
          {hint && <div className="muted">{hint}</div>}
          {error && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
        </div>
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
