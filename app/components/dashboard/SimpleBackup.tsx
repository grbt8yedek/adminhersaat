'use client'
import { useState, useEffect } from 'react'
import { Download, Settings, X, Clock } from 'lucide-react'

interface BackupConfig {
  enabled: boolean
  schedule: string
  retention: number
  includeDatabase: boolean
  includeUploads: boolean
  includeLogs: boolean
}

interface BackupStatus {
  config: BackupConfig
  lastBackup?: string
  nextBackup?: string
  backupSize: number
  status: string
}

export default function SimpleBackup() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>({
    config: {
      enabled: false,
      schedule: '0 2 * * *',
      retention: 7,
      includeDatabase: true,
      includeUploads: true,
      includeLogs: true
    },
    lastBackup: undefined,
    nextBackup: undefined,
    backupSize: 0,
    status: 'inactive'
  })
  const [loading, setLoading] = useState(false)
  const [autoBackupModalOpen, setAutoBackupModalOpen] = useState(false)
  const [tempConfig, setTempConfig] = useState<BackupConfig | null>({
    enabled: false,
    schedule: '0 2 * * *',
    retention: 7,
    includeDatabase: true,
    includeUploads: true,
    includeLogs: true
  })

  useEffect(() => {
    fetchBackupStatus()
  }, [])

  const fetchBackupStatus = async () => {
    try {
      const response = await fetch('/api/system/backup')
      const data = await response.json()
      if (data.success) {
        setBackupStatus(data.data)
        setTempConfig(data.data.config)
      }
    } catch (error) {
      console.error('Yedekleme durumu alınamadı:', error)
      // API hatası durumunda default değerler set et
      const defaultConfig = {
        enabled: false,
        schedule: '0 2 * * *',
        retention: 7,
        includeDatabase: true,
        includeUploads: true,
        includeLogs: true
      }
      setBackupStatus({
        config: defaultConfig,
        lastBackup: undefined,
        nextBackup: undefined,
        backupSize: 0,
        status: 'inactive'
      })
      setTempConfig(defaultConfig)
    }
  }

  const handleManualBackup = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/system/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      })
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ Yedekleme başarıyla oluşturuldu!\n\nBoyut: ${data.size}\nKonum: ${data.path}`)
        fetchBackupStatus()
      } else {
        alert('❌ Yedekleme oluşturulamadı: ' + data.error)
      }
    } catch (error) {
      alert('❌ Yedekleme işlemi başarısız')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoBackupClick = () => {
    setAutoBackupModalOpen(true)
  }

  const handleSaveAutoBackup = async () => {
    if (!tempConfig) return

    try {
      const response = await fetch('/api/system/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'configure', 
          config: tempConfig 
        })
      })
      const data = await response.json()
      
      if (data.success) {
        alert('✅ Otomatik yedekleme ayarları kaydedildi!')
        await fetchBackupStatus()
        setAutoBackupModalOpen(false)
      } else {
        alert('❌ Ayarlar kaydedilemedi: ' + data.error)
      }
    } catch (error) {
      alert('❌ İşlem başarısız')
    }
  }

  const formatLastBackupTime = (lastBackup: string | undefined) => {
    if (!lastBackup) return 'Henüz yedekleme yapılmamış'
    
    const date = new Date(lastBackup)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} gün önce (${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`
    } else if (diffHours > 0) {
      return `${diffHours} saat önce (${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`
    } else {
      return `Az önce (${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Yedekleme Sistemi</h3>
      
      {/* Butonlar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <button
          onClick={handleManualBackup}
          disabled={loading}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Yedekleniyor...' : 'Yedek Al'}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoBackupClick}
            className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Otomatik Yedek
          </button>
          
          {/* Aktif/Kapalı Durumu */}
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            backupStatus?.config.enabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {backupStatus?.config.enabled ? 'Aktif' : 'Kapalı'}
          </span>
        </div>
      </div>

      {/* Son Yedekleme Zamanı */}
      <div className="flex items-center text-sm text-gray-600 bg-gray-50 rounded-md p-3">
        <Clock className="h-4 w-4 mr-2 text-gray-400" />
        <span className="font-medium">Son Yedekleme:</span>
        <span className="ml-2">{formatLastBackupTime(backupStatus?.lastBackup)}</span>
      </div>

      {/* Otomatik Yedek Ayarları Modal */}
      {autoBackupModalOpen && tempConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Otomatik Yedek Ayarları</h3>
              <button
                onClick={() => setAutoBackupModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Otomatik Yedekleme Açık/Kapalı */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={tempConfig.enabled}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      enabled: e.target.checked
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Otomatik yedeklemeyi etkinleştir
                  </span>
                </label>
              </div>

              {/* Yedekleme Saati */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yedekleme Zamanı
                </label>
                <select
                  value={tempConfig.schedule.split(' ')[1] || '2'}
                  onChange={(e) => {
                    const newSchedule = `0 ${e.target.value} * * *`
                    setTempConfig({
                      ...tempConfig,
                      schedule: newSchedule
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Her gün bu saatte otomatik yedekleme yapılır</p>
              </div>

              {/* Yedekleme Aralığı (Saklama Süresi) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yedekleri Saklama Süresi
                </label>
                <select
                  value={tempConfig.retention}
                  onChange={(e) => setTempConfig({
                    ...tempConfig,
                    retention: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 gün</option>
                  <option value={3}>3 gün</option>
                  <option value={7}>1 hafta</option>
                  <option value={14}>2 hafta</option>
                  <option value={30}>1 ay</option>
                  <option value={90}>3 ay</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Bu süreden eski yedekler otomatik silinir</p>
              </div>

              {/* Yedeklenecek İçerik */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yedeklenecek İçerik
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tempConfig.includeDatabase}
                      onChange={(e) => setTempConfig({
                        ...tempConfig,
                        includeDatabase: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Veritabanı</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tempConfig.includeUploads}
                      onChange={(e) => setTempConfig({
                        ...tempConfig,
                        includeUploads: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Yüklenen Dosyalar</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tempConfig.includeLogs}
                      onChange={(e) => setTempConfig({
                        ...tempConfig,
                        includeLogs: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Sistem Logları</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setAutoBackupModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={handleSaveAutoBackup}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
