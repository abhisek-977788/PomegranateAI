import React, { useRef, useEffect } from 'react'

const COLORS = {
  Alternaria:      '#ef4444',
  Anthracnose:     '#f97316',
  Bacterial_Blight:'#eab308',
  Cercospora:      '#a855f7',
  Healthy:         '#22c55e',
}

export function BBoxOverlay({ imageUrl, bboxes = [], healthLabel = 'Healthy' }) {
  const canvasRef = useRef(null)
  const imgRef    = useRef(null)

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const img    = new Image()
    img.src = imageUrl

    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)

      if (bboxes.length === 0 && healthLabel !== 'Healthy') {
        // Draw full-image highlight when defect detected but no bbox
        ctx.strokeStyle = COLORS[healthLabel] || '#ef4444'
        ctx.lineWidth   = Math.max(2, canvas.width * 0.005)
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
        ctx.fillStyle = (COLORS[healthLabel] || '#ef4444') + '22'
        ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20)
      }

      bboxes.forEach((box) => {
        const color = COLORS[box.label] || '#ef4444'
        const lw    = Math.max(2, canvas.width * 0.004)
        ctx.strokeStyle = color
        ctx.lineWidth   = lw
        const x = box.xmin * canvas.width
        const y = box.ymin * canvas.height
        const w = (box.xmax - box.xmin) * canvas.width
        const h = (box.ymax - box.ymin) * canvas.height
        ctx.strokeRect(x, y, w, h)

        // Label background
        const label = (box.label || '') + ' ' + ((box.confidence || 0) * 100).toFixed(0) + '%'
        ctx.font = `bold ${Math.max(12, canvas.width * 0.03)}px sans-serif`
        const tw  = ctx.measureText(label).width
        const th  = Math.max(14, canvas.width * 0.035)
        ctx.fillStyle = color
        ctx.fillRect(x, y - th, tw + 8, th)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, x + 4, y - 3)
      })
    }
  }, [imageUrl, bboxes, healthLabel])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain rounded-lg"
    />
  )
}
