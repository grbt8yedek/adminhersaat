'use client'
import { useState } from 'react'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import AdminPanelStatus from '../components/dashboard/AdminPanelStatus'
import MainSiteStatus from '../components/dashboard/MainSiteStatus'
import SimpleBackup from '../components/dashboard/SimpleBackup'

export default function SistemPage() {
  const [activeTab, setActiveTab] = useState('sistem')

  return (
    <div className="flex h-screen bg-gray-100 w-full">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Sağ İçerik Alanı */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header */}
        <Header />

        {/* Ana İçerik */}
        <main className="flex-1 p-4 w-full overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            <MainSiteStatus />
            <AdminPanelStatus />
            <SimpleBackup />
          </div>
        </main>
      </div>
    </div>
  )
} 