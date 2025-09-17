'use client'
import { X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface BackupModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const [schedule, setSchedule] = useState('0 16 * * *')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchCurrentSchedule()
    }
  }, [isOpen])

  const fetchCurrentSchedule = async () => {
    try {
      const response = await fetch('/api/system/cronjob')
      const data = await response.json()
      if (data.success) {
        setSchedule(data.data.schedule)
      }
    } catch (error) {
      console.error('Cronjob bilgisi alınamadı:', error)
    }
  }

  const updateSchedule = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/system/cronjob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ schedule })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage('✅ Cronjob zamanı güncellendi! Deploy edildiğinde aktif olacak.')
      } else {
        setMessage(`❌ Hata: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Güncelleme başarısız!')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Backup Ayarları</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitLab Otomatik Yedekleme Zamanı
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 16 * * *"
              />
              <button
                onClick={updateSchedule}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Güncelleniyor...' : 'Güncelle'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Format: dakika saat gün ay hafta (örn: 0 16 * * * = her gün 16:00)
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <div className="bg-gray-50 p-3 rounded-md">
            <h3 className="font-medium text-gray-900 mb-2">Mevcut Cronjob'lar:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• GitHub: Her 6 saatte (0 */6 * * *)</li>
              <li>• GitLab: {schedule}</li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}