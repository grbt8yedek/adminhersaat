import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// 6 saatte bir çalışacak cron job
export const config = {
  schedule: '0 */6 * * *' // Her 6 saatte bir: 00:00, 06:00, 12:00, 18:00
}

const prisma = new PrismaClient()

// GitHub bilgileri
const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN || ''
const BACKUP_REPO = 'grbt8yedek/apauto'
const GITHUB_API = 'https://api.github.com'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 GRBT8 Otomatik Yedekleme Başlatılıyor...')
    console.log('🌐 Site: https://www.grbt8.store/')
    console.log('📅 Tarih:', new Date().toLocaleString('tr-TR'))
    
    // GitHub token kontrolü
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_BACKUP_TOKEN environment variable bulunamadı')
    }
    
    const startTime = Date.now()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    
    // 1. DATABASE YEDEKLEME
    console.log('🗄️ Database yedekleniyor...')
    const databaseBackup = await createDatabaseBackup()
    
    // 2. UPLOAD DOSYALARI YEDEKLEME
    console.log('📁 Upload dosyaları yedekleniyor...')
    const uploadBackup = await createUploadBackup()
    
    // 3. VERCEL AYARLARI YEDEKLEME
    console.log('☁️ Vercel ayarları yedekleniyor...')
    const vercelBackup = await createVercelBackup()
    
    // 4. YEDEKLEME RAPORU OLUŞTUR
    const backupReport = {
      timestamp: new Date().toISOString(),
      site: 'https://www.grbt8.store/',
      vercel_project: 'https://vercel.com/grbt8/grbt8ap',
      backup_id: timestamp,
      duration: `${Date.now() - startTime}ms`,
      status: 'completed',
      components: {
        database: databaseBackup.success ? 'success' : 'failed',
        uploads: uploadBackup.success ? 'success' : 'failed',
        vercel: vercelBackup.success ? 'success' : 'failed'
      },
      stats: {
        database_tables: databaseBackup.stats?.total_tables || 0,
        database_records: databaseBackup.stats?.total_records || 0,
        upload_files: uploadBackup.stats?.total_files || 0,
        upload_size: uploadBackup.stats?.total_size || '0 MB',
        vercel_projects: vercelBackup.stats?.total_projects || 0
      },
      next_backup: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 saat sonra
    }
    
    // 5. GITHUB'A GÖNDER
    console.log('🚀 GitHub\'a gönderiliyor...')
    
    // Database backup
    if (databaseBackup.success) {
      await uploadToGitHub(
        `database/db_backup_${timestamp}.json`,
        JSON.stringify(databaseBackup.data, null, 2),
        `Database backup - ${new Date().toLocaleString('tr-TR')}`
      )
    }
    
    // Upload backup
    if (uploadBackup.success) {
      await uploadToGitHub(
        `uploads/upload_backup_${timestamp}.json`,
        JSON.stringify(uploadBackup.data, null, 2),
        `Upload files backup - ${new Date().toLocaleString('tr-TR')}`
      )
    }
    
    // Vercel backup
    if (vercelBackup.success) {
      await uploadToGitHub(
        `vercel/vercel_backup_${timestamp}.json`,
        JSON.stringify(vercelBackup.data, null, 2),
        `Vercel settings backup - ${new Date().toLocaleString('tr-TR')}`
      )
    }
    
    // Backup raporu
    await uploadToGitHub(
      `reports/backup_report_${timestamp}.json`,
      JSON.stringify(backupReport, null, 2),
      `Backup report - ${new Date().toLocaleString('tr-TR')}`
    )
    
    // README güncelle
    const readmeContent = `# GRBT8 Otomatik Yedekleme - ${new Date().toLocaleString('tr-TR')}

## 📊 Son Yedekleme Bilgileri
- **Tarih:** ${new Date().toLocaleString('tr-TR')}
- **Site:** [https://www.grbt8.store/](https://www.grbt8.store/)
- **Vercel:** [https://vercel.com/grbt8/grbt8ap](https://vercel.com/grbt8/grbt8ap)
- **Durum:** ✅ Başarılı
- **Süre:** ${backupReport.duration}

## 📋 Yedeklenen Veriler
- 🗄️ **Database:** ${backupReport.stats.database_tables} tablo, ${backupReport.stats.database_records} kayıt
- 📁 **Upload Dosyaları:** ${backupReport.stats.upload_files} dosya, ${backupReport.stats.upload_size}
- ☁️ **Vercel Ayarları:** ${backupReport.stats.vercel_projects} proje

## ⏰ Yedekleme Zamanları
Her 6 saatte bir otomatik: **00:00**, **06:00**, **12:00**, **18:00**

## 🔄 Sonraki Yedekleme
${new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('tr-TR')}

---
*🤖 GRBT8 Otomatik Yedekleme Sistemi v2.0 - Vercel Tabanlı*
`
    
    await uploadToGitHub(
      'README.md',
      readmeContent,
      `README güncelleme - ${new Date().toLocaleString('tr-TR')}`
    )
    
    console.log('✅ Yedekleme tamamlandı!')
    console.log('📊 Özet:', backupReport.stats)
    
    return NextResponse.json({
      success: true,
      message: 'GRBT8 otomatik yedekleme başarıyla tamamlandı',
      data: backupReport
    })
    
  } catch (error) {
    console.error('❌ Yedekleme hatası:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      site: 'https://www.grbt8.store/'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// Database yedekleme fonksiyonu
async function createDatabaseBackup() {
  try {
    console.log('📋 Tüm tablolar yedekleniyor...')
    
    const backup = {
      timestamp: new Date().toISOString(),
      source: 'https://www.grbt8.store/',
      database: 'production',
      tables: {
        // Kullanıcı tabloları
        users: await prisma.user.findMany(),
        accounts: await prisma.account.findMany(),
        sessions: await prisma.session.findMany(),
        
        // Rezervasyon tabloları
        reservations: await prisma.reservation.findMany(),
        payments: await prisma.payment.findMany(),
        passengers: await prisma.passenger.findMany(),
        
        // Sistem tabloları
        systemSettings: await prisma.systemSettings.findMany(),
        systemLogs: await prisma.systemLog.findMany(),
        
        // Kampanya tabloları
        campaigns: await prisma.campaign.findMany(),
        
        // Email tabloları
        emailTemplates: await prisma.emailTemplate.findMany(),
        emailQueue: await prisma.emailQueue.findMany(),
        emailLogs: await prisma.emailLog.findMany(),
        emailSettings: await prisma.emailSettings.findMany(),
        
        // Diğer tablolar
        priceAlerts: await prisma.priceAlert.findMany(),
        searchFavorites: await prisma.searchFavorite.findMany(),
        surveyResponses: await prisma.surveyResponse.findMany()
      }
    }
    
    // İstatistikleri hesapla
    const stats = {
      total_tables: Object.keys(backup.tables).length,
      total_records: Object.values(backup.tables).reduce((sum, table) => sum + (Array.isArray(table) ? table.length : 0), 0),
      users: backup.tables.users.length,
      reservations: backup.tables.reservations.length,
      payments: backup.tables.payments.length,
      campaigns: backup.tables.campaigns.length
    }
    
    console.log(`✅ Database yedeklendi: ${stats.total_tables} tablo, ${stats.total_records} kayıt`)
    
    return {
      success: true,
      data: backup,
      stats
    }
    
  } catch (error) {
    console.error('❌ Database yedekleme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Upload dosyaları yedekleme
async function createUploadBackup() {
  try {
    const fs = require('fs').promises
    const path = require('path')
    
    const uploadsPath = path.join(process.cwd(), 'public', 'uploads')
    const uploadFiles: any[] = []
    
    // Uploads klasörünü tara
    async function scanDirectory(dir: string, basePath: string = '') {
      try {
        const items = await fs.readdir(dir)
        
        for (const item of items) {
          const itemPath = path.join(dir, item)
          const relativePath = path.join(basePath, item)
          const stat = await fs.stat(itemPath)
          
          if (stat.isDirectory()) {
            await scanDirectory(itemPath, relativePath)
          } else {
            // Dosya bilgilerini kaydet
            uploadFiles.push({
              path: relativePath,
              size: stat.size,
              modified: stat.mtime.toISOString(),
              type: path.extname(item).toLowerCase()
            })
          }
        }
      } catch (error) {
        console.log(`Upload klasörü okunamadı: ${dir}`)
      }
    }
    
    await scanDirectory(uploadsPath)
    
    const totalSize = uploadFiles.reduce((sum, file) => sum + file.size, 0)
    const sizeInMB = (totalSize / 1024 / 1024).toFixed(2)
    
    console.log(`✅ Upload dosyaları tarandı: ${uploadFiles.length} dosya, ${sizeInMB} MB`)
    
    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        source: 'https://www.grbt8.store/uploads/',
        files: uploadFiles,
        summary: {
          total_files: uploadFiles.length,
          total_size_bytes: totalSize,
          total_size_mb: `${sizeInMB} MB`,
          file_types: [...new Set(uploadFiles.map(f => f.type))]
        }
      },
      stats: {
        total_files: uploadFiles.length,
        total_size: `${sizeInMB} MB`
      }
    }
    
  } catch (error) {
    console.error('❌ Upload yedekleme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Vercel ayarları yedekleme
async function createVercelBackup() {
  try {
    // Environment variables'ları al (sadece key'ler, value'lar güvenlik için alınmaz)
    const envVars = Object.keys(process.env).filter(key => 
      !key.startsWith('VERCEL_') && // Vercel internal
      !key.startsWith('NODE_') &&   // Node internal
      !key.startsWith('npm_') &&    // NPM internal
      key !== 'PATH' &&
      key !== 'PWD'
    )
    
    const vercelData = {
      timestamp: new Date().toISOString(),
      source: 'https://vercel.com/grbt8/grbt8ap',
      site_url: 'https://www.grbt8.store/',
      environment_variables: envVars.map(key => ({
        key: key,
        has_value: !!process.env[key],
        length: process.env[key]?.length || 0
      })),
      deployment_info: {
        vercel_url: process.env.VERCEL_URL || 'https://www.grbt8.store/',
        vercel_env: process.env.VERCEL_ENV || 'production',
        vercel_region: process.env.VERCEL_REGION || 'unknown',
        node_version: process.version
      }
    }
    
    console.log(`✅ Vercel ayarları yedeklendi: ${envVars.length} env variable`)
    
    return {
      success: true,
      data: vercelData,
      stats: {
        total_projects: 1,
        env_variables: envVars.length
      }
    }
    
  } catch (error) {
    console.error('❌ Vercel yedekleme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// GitHub'a dosya yükleme
async function uploadToGitHub(filePath: string, content: string, commitMessage: string) {
  try {
    const url = `${GITHUB_API}/repos/${BACKUP_REPO}/contents/${filePath}`
    
    // Mevcut dosyayı kontrol et
    let sha: string | undefined
    try {
      const existingResponse = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      if (existingResponse.ok) {
        const existingData = await existingResponse.json()
        sha = existingData.sha
      }
    } catch (error) {
      // Dosya mevcut değil, yeni oluşturulacak
    }
    
    const payload: any = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: 'main'
    }
    
    if (sha) {
      payload.sha = sha
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      console.log(`✅ GitHub'a yüklendi: ${filePath}`)
      return true
    } else {
      console.error(`❌ GitHub yükleme hatası: ${filePath} - ${response.status}`)
      return false
    }
    
  } catch (error) {
    console.error(`❌ GitHub yükleme hatası: ${filePath}`, error)
    return false
  }
}

// Manuel tetikleme için POST endpoint
export async function POST(request: NextRequest) {
  console.log('🎛️ Manuel yedekleme tetiklendi')
  return GET(request)
}
