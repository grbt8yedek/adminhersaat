'use client'
import { useState, useEffect } from 'react'
import { X, Upload, Calendar, Link, Eye, Check } from 'lucide-react'

interface Campaign {
  id: string
  title: string
  description: string
  imageUrl: string
  imageData?: string  // Base64 image data - Neon database'de sakla
  altText: string
  linkUrl: string
  status: 'active' | 'inactive'
  position: number
  startDate: string
  endDate: string
  clickCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

interface CampaignModalProps {
  isOpen: boolean
  onClose: () => void
  campaign?: Campaign | null
  onSave: (campaign: Campaign) => void
}

export default function CampaignModal({ isOpen, onClose, campaign, onSave }: CampaignModalProps) {
  const [formData, setFormData] = useState<Campaign>({
    id: '',
    title: '',
    description: '',
    imageUrl: '',
    imageData: '',  // Base64 image data
    altText: '',
    linkUrl: '',
    status: 'active',
    position: 1,
    startDate: '',
    endDate: '',
    clickCount: 0,
    viewCount: 0,
    createdAt: '',
    updatedAt: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => {
    if (campaign) {
      setFormData(campaign)
      setImagePreview(campaign.imageUrl)
    } else {
      setFormData({
        id: '',
        title: '',
        description: '',
        imageUrl: '',
        imageData: '',  // Base64 image data
        altText: '',
        linkUrl: '',
        status: 'active',
        position: 1,
        startDate: '',
        endDate: '',
        clickCount: 0,
        viewCount: 0,
        createdAt: '',
        updatedAt: ''
      })
      setImagePreview('')
    }
    setUploadSuccess(false)
  }, [campaign])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setUploadSuccess(false)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setFormData(prev => ({ ...prev, imageUrl: data.url, imageData: data.url }))
        setImagePreview(data.url)
        setUploadSuccess(true)
        
        // 3 saniye sonra başarı mesajını kaldır
        setTimeout(() => setUploadSuccess(false), 3000)
      } else {
        alert('Resim yükleme hatası')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Resim yükleme hatası')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) {
      alert('Kampanya başlığı gereklidir.')
      return
    }

    setIsLoading(true)
    try {
      console.log('🚀 Kampanya kaydediliyor:', formData)
      const response = await fetch('/api/campaigns', {
        method: campaign ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('📡 API Response:', { status: response.status, data })
      
      if (response.ok && data.success) {
        console.log('✅ Kampanya başarıyla kaydedildi')
        onSave(data.data)
        // onClose() - CampaignsTab'da hallediliyor
      } else {
        console.error('❌ API Error:', data)
        alert(data.error || 'Kampanya kaydetme hatası')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Kampanya kaydetme hatası')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {campaign ? 'Kampanya Düzenle' : 'Yeni Kampanya Ekle'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Temel Bilgiler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kampanya Başlığı *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: Erken Rezervasyon İndirimi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Kampanya açıklaması..."
            />
          </div>

          {/* Resim Yükleme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kampanya Resmi
            </label>
            <div className="space-y-4">
              {/* Resim Önizleme */}
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('')
                      setFormData(prev => ({ ...prev, imageUrl: '' }))
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Resim Yükleme Butonu */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  disabled={isLoading}
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {isLoading ? 'Yükleniyor...' : 'Resim seç veya sürükle'}
                  </span>
                  <span className="text-xs text-gray-500">
                    PNG, JPG, WEBP, GIF (Max: 20MB)
                  </span>
                </label>
              </div>
              
              {/* Yükleme Durumu */}
              {isLoading && (
                <p className="text-sm text-blue-600 text-center">
                  Resim yükleniyor...
                </p>
              )}
              {uploadSuccess && (
                <p className="text-sm text-green-600 text-center flex items-center justify-center">
                  <Check className="h-4 w-4 mr-1" />
                  Resim başarıyla yüklendi!
                </p>
              )}
            </div>
          </div>

          {/* Alt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alt Text (SEO)
            </label>
            <input
              type="text"
              value={formData.altText}
              onChange={(e) => setFormData(prev => ({ ...prev, altText: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Resim açıklaması..."
            />
          </div>

          {/* Link ve Pozisyon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yönlendirme Linki
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pozisyon
              </label>
              <input
                type="number"
                min="1"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tarih Aralığı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Başlangıç Tarihi
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bitiş Tarihi
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.title}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Kaydediliyor...' : (campaign ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
