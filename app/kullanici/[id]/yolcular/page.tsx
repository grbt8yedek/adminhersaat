'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '../../../components/layout/Sidebar'
import Header from '../../../components/layout/Header'
import { Users, Save, ArrowLeft, Edit, User } from 'lucide-react'

interface Passenger {
  id: string
  name: string
  firstName: string
  lastName: string
  phone: string
  countryCode: string
  fullPhone: string
  identityNumber: string
  birthDate: string
  birthDay: string
  birthMonth: string
  birthYear: string
  gender: string
  isForeigner: boolean
  isAccountOwner: boolean
  createdAt: string
  updatedAt: string
}

export default function YolcularPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('users')
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  // Form state - her yolcu için ayrı form
  const [formData, setFormData] = useState<{ [key: string]: any }>({})

  useEffect(() => {
    fetchPassengers()
    fetchUserName()
  }, [params.id])

  const fetchUserName = async () => {
    try {
      const response = await fetch(`/api/users/${params.id}`)
      const data = await response.json()
      if (data.success) {
        setUserName(data.data.name)
      }
    } catch (error) {
      console.error('Kullanıcı adı alınamadı:', error)
    }
  }

  const fetchPassengers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/passengers?userId=${params.id}`)
      const data = await response.json()
      
      if (data.success) {
        setPassengers(data.data)
        // Form verilerini doldur
        const initialFormData: { [key: string]: any } = {}
        data.data.forEach((passenger: Passenger) => {
          initialFormData[passenger.id] = {
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            phone: passenger.phone,
            countryCode: passenger.countryCode,
            identityNumber: passenger.identityNumber,
            birthDay: passenger.birthDay,
            birthMonth: passenger.birthMonth,
            birthYear: passenger.birthYear,
            gender: passenger.gender,
            isForeigner: passenger.isForeigner
          }
        })
        setFormData(initialFormData)
      } else {
        setError(data.error || 'Yolcular bulunamadı')
      }
    } catch (err) {
      setError('Yolcular yüklenirken hata oluştu')
      console.error('Yolcu yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (passengerId: string, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [passengerId]: {
        ...prev[passengerId],
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      // Her yolcu için ayrı ayrı güncelleme yap
      const updatePromises = passengers.map(passenger => {
        const passengerData = formData[passenger.id]
        if (!passengerData) return Promise.resolve()

        return fetch(`/api/passengers/${passenger.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(passengerData)
        })
      })

      const responses = await Promise.all(updatePromises)
      const results = await Promise.all(responses.map(r => r.json()))

      // Başarılı güncellemeleri say
      const successCount = results.filter(r => r.success).length
      
      if (successCount === passengers.length) {
        setSuccess(`${successCount} yolcu başarıyla güncellendi!`)
        // Yolcu verilerini yenile
        await fetchPassengers()
      } else {
        setError(`${successCount}/${passengers.length} yolcu güncellendi`)
      }
    } catch (err) {
      setError('Güncelleme sırasında hata oluştu')
      console.error('Güncelleme hatası:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Yolcu bilgileri yükleniyor...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error && passengers.length === 0) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center">
                <div className="text-red-600 text-xl mb-4">⚠️ Hata</div>
                <p className="text-gray-600 mb-4">{error}</p>
                <button 
                  onClick={() => router.push(`/kullanici/${params.id}`)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Kullanıcı Detayına Dön
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Ana İçerik */}
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl mx-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => router.push(`/kullanici/${params.id}`)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">Yolcular</h1>
                    <p className="text-sm text-gray-500">{userName} - {passengers.length} yolcu</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600">{passengers.length} Yolcu</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Hata/Success Mesajları */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              )}

              {/* Yolcu Grid - 2x2 */}
              <div className="grid grid-cols-2 gap-6">
                {passengers.map((passenger, index) => (
                  <div key={passenger.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Yolcu Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <h3 className="font-medium text-gray-900">
                          {passenger.name}
                          {passenger.isAccountOwner && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Hesap Sahibi
                            </span>
                          )}
                        </h3>
                      </div>
                      <Edit className="h-4 w-4 text-gray-400" />
                    </div>

                    {/* Yolcu Form */}
                    <div className="space-y-3">
                      {/* Ad Soyad */}
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="Ad"
                          value={formData[passenger.id]?.firstName || ''}
                          onChange={(e) => handleInputChange(passenger.id, 'firstName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input 
                          type="text" 
                          placeholder="Soyad"
                          value={formData[passenger.id]?.lastName || ''}
                          onChange={(e) => handleInputChange(passenger.id, 'lastName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Telefon */}
                      <div className="flex gap-2">
                        <select 
                          value={formData[passenger.id]?.countryCode || '+90'}
                          onChange={(e) => handleInputChange(passenger.id, 'countryCode', e.target.value)}
                          className="w-24 px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="+90">🇹🇷 +90</option>
                          <option value="+49">🇩🇪 +49</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+33">🇫🇷 +33</option>
                        </select>
                        <input 
                          type="tel" 
                          placeholder="Telefon"
                          value={formData[passenger.id]?.phone || ''}
                          onChange={(e) => handleInputChange(passenger.id, 'phone', e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* TC Kimlik No */}
                      <div className="flex items-center space-x-2">
                        <input 
                          type="text" 
                          placeholder="TC Kimlik No"
                          value={formData[passenger.id]?.identityNumber || ''}
                          onChange={(e) => handleInputChange(passenger.id, 'identityNumber', e.target.value)}
                          maxLength={11}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <label className="flex items-center text-xs text-gray-600">
                          <input 
                            type="checkbox" 
                            checked={formData[passenger.id]?.isForeigner || false}
                            onChange={(e) => handleInputChange(passenger.id, 'isForeigner', e.target.checked)}
                            className="mr-1"
                          />
                          Yabancı
                        </label>
                      </div>

                      {/* Doğum Tarihi ve Cinsiyet */}
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="date" 
                          value={formData[passenger.id]?.birthYear && formData[passenger.id]?.birthMonth && formData[passenger.id]?.birthDay ? 
                            `${formData[passenger.id].birthYear}-${formData[passenger.id].birthMonth.padStart(2, '0')}-${formData[passenger.id].birthDay.padStart(2, '0')}` : ''}
                          onChange={(e) => {
                            const date = new Date(e.target.value)
                            handleInputChange(passenger.id, 'birthDay', date.getDate().toString())
                            handleInputChange(passenger.id, 'birthMonth', (date.getMonth() + 1).toString())
                            handleInputChange(passenger.id, 'birthYear', date.getFullYear().toString())
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <select 
                          value={formData[passenger.id]?.gender || ''}
                          onChange={(e) => handleInputChange(passenger.id, 'gender', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Cinsiyet</option>
                          <option value="male">Erkek</option>
                          <option value="female">Kadın</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Boş alanları doldur */}
              {passengers.length < 4 && (
                <div className="grid grid-cols-2 gap-6 mt-6">
                  {Array.from({ length: 4 - passengers.length }).map((_, index) => (
                    <div key={`empty-${index}`} className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <User className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Boş Alan</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button 
                onClick={() => router.push(`/kullanici/${params.id}`)}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Geri Dön</span>
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-md ${
                  saving 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
