'use client'

import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
  timeLabel: string
}

export function ExportButton({ containerRef, timeLabel }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!containerRef.current || exporting) return
    setExporting(true)

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png', 0.95)
      })

      const file = new File([blob], `fitos-report-${timeLabel}.png`, { type: 'image/png' })

      // Try native share first (iOS PWA)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `FitOS Report - ${timeLabel}`,
          files: [file],
        })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="text-[.78rem] font-bold px-3 py-1.5 rounded-full border border-gray-200 cursor-pointer transition-all hover:border-primary hover:text-primary flex items-center gap-1.5 disabled:opacity-50"
    >
      {exporting ? (
        <span className="animate-spin text-[.9rem]">&#9696;</span>
      ) : (
        <span className="text-[.9rem]">&#8599;</span>
      )}
      {exporting ? 'Exportando...' : 'Exportar'}
    </button>
  )
}
