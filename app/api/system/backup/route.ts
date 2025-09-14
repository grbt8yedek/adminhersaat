import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { createLog } from '@/app/lib/logger'

const execAsync = promisify(exec)

interface BackupConfig {
  enabled: boolean
  schedule: string // cron format
  retention: number // days
  includeDatabase: boolean
  includeUploads: boolean
  includeLogs: boolean
  lastBackup?: string
  nextBackup?: string
}

export async function GET() {
  try {
    // Yedekleme konfigürasyonunu oku
    const configPath = path.join(process.cwd(), 'shared', 'backup-config.json')
    let config: BackupConfig = {
      enabled: false,
      schedule: '0 2 * * *', // Her gün saat 02:00
      retention: 7,
      includeDatabase: true,
      includeUploads: true,
      includeLogs: true
    }

    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8')
      config = { ...config, ...JSON.parse(configData) }
    }

    // Son yedekleme bilgilerini al
    const backupDir = path.join(process.cwd(), '..', 'admin64_backup')
    let lastBackup = null
    let backupSize = 0

    if (fs.existsSync(backupDir)) {
      const stats = fs.statSync(backupDir)
      lastBackup = stats.mtime.toISOString()
      
      // Klasör boyutunu hesapla
      try {
        const { stdout } = await execAsync(`du -sh "${backupDir}"`)
        backupSize = parseInt(stdout.split('\t')[0].replace(/[^\d]/g, '')) || 0
      } catch (error) {
        console.log('Backup boyutu hesaplanamadı')
      }
    }

    // Sonraki yedekleme zamanını hesapla
    const nextBackup = calculateNextBackup(config.schedule)

    return NextResponse.json({
      success: true,
      data: {
        config,
        lastBackup,
        nextBackup,
        backupSize,
        status: config.enabled ? 'active' : 'disabled'
      }
    })
  } catch (error) {
    console.error('Yedekleme durumu alınamadı:', error)
    return NextResponse.json({
      success: false,
      error: 'Yedekleme durumu alınamadı'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, config } = body

    if (action === 'create') {
      // Manuel yedekleme oluştur
      const result = await createBackup()
      
      if (result.success) {
        await createLog({
          level: 'INFO',
          message: 'Manuel yedekleme oluşturuldu',
          source: 'backup',
          metadata: {
            backupPath: result.path,
            size: result.size
          }
        })
      }

      return NextResponse.json(result)
    }

    if (action === 'gitlab') {
      // GitLab'a yedekleme oluştur
      const result = await createGitLabBackup()

      if (result.success) {
        await createLog({
          level: 'INFO',
          message: 'GitLab yedekleme oluşturuldu',
          source: 'backup-gitlab',
          metadata: {
            repository: result.repository,
            files: result.files,
            size: result.size
          }
        })
      }

      return NextResponse.json(result)
    }

    if (action === 'configure') {
      // Yedekleme konfigürasyonunu güncelle
      const configPath = path.join(process.cwd(), 'shared', 'backup-config.json')
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      
      await createLog({
        level: 'INFO',
        message: 'Yedekleme konfigürasyonu güncellendi',
        source: 'backup',
        metadata: config
      })

      return NextResponse.json({
        success: true,
        message: 'Yedekleme konfigürasyonu güncellendi'
      })
    }

    if (action === 'toggle') {
      // Yedekleme durumunu aç/kapat
      const configPath = path.join(process.cwd(), 'shared', 'backup-config.json')
      let currentConfig: BackupConfig = {
        enabled: false,
        schedule: '0 2 * * *',
        retention: 7,
        includeDatabase: true,
        includeUploads: true,
        includeLogs: true
      }

      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8')
        currentConfig = { ...currentConfig, ...JSON.parse(configData) }
      }

      currentConfig.enabled = !currentConfig.enabled
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2))

      await createLog({
        level: 'INFO',
        message: `Otomatik yedekleme ${currentConfig.enabled ? 'açıldı' : 'kapatıldı'}`,
        source: 'backup',
        metadata: { enabled: currentConfig.enabled }
      })

      return NextResponse.json({
        success: true,
        message: `Otomatik yedekleme ${currentConfig.enabled ? 'açıldı' : 'kapatıldı'}`,
        enabled: currentConfig.enabled
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Geçersiz işlem'
    })
  } catch (error) {
    console.error('Yedekleme işlemi hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Yedekleme işlemi başarısız'
    })
  }
}

async function createBackup() {
  try {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '') // HHMMSS
    const backupName = `bckp${dateStr}${timeStr}`
    const backupPath = path.join(process.cwd(), '..', backupName)
    
    // Yedekleme klasörünü oluştur
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true })
    }

    // Admin paneli yedekle
    const adminSource = path.join(process.cwd())
    const adminDest = path.join(backupPath, 'grbt8ap')
    await execAsync(`cp -r "${adminSource}" "${adminDest}"`)

    // Ana site yedekle
    const mainSource = path.join(process.cwd(), '..', 'grbt8')
    const mainDest = path.join(backupPath, 'grbt8')
    if (fs.existsSync(mainSource)) {
      await execAsync(`cp -r "${mainSource}" "${mainDest}"`)
    }

    // README dosyası oluştur
    const readmeContent = `# Backup - ${new Date().toLocaleString('tr-TR')}

Bu yedek şunları içerir:
- grbt8ap: Admin paneli (port 3004)
- grbt8: Ana site (port 4000)

Yedek adı: ${backupName}
Yedek tarihi: ${new Date().toLocaleString('tr-TR')}
Oluşturan: Otomatik yedekleme sistemi
`
    fs.writeFileSync(path.join(backupPath, 'README.md'), readmeContent)

    // Yedekleme boyutunu hesapla
    const { stdout } = await execAsync(`du -sh "${backupPath}"`)
    const size = stdout.split('\t')[0]

    return {
      success: true,
      message: 'Yedekleme başarıyla oluşturuldu',
      path: backupPath,
      size: size,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Yedekleme oluşturma hatası:', error)
    return {
      success: false,
      error: 'Yedekleme oluşturulamadı'
    }
  }
}

async function createGitLabBackup() {
  try {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupName = `backup_${timestamp}`

    // GitLab bilgileri (hardcoded for now)
    const GITLAB_TOKEN = 'glpat-KYIkNq_KQtxWTvd5vRMxvG86MQp1OmkwanlyCw.01.120j4le7y'
    const PROJECT_ID = 'depogrbt8-backup%2Fgrbt8ap-backup'
    const BRANCH = 'main'

    // Gerçek database dump oluştur
    const databaseDump = await createRealDatabaseDump()
    
    // Gerçek config backup oluştur
    const configBackup = await createRealConfigBackup()
    
    // Admin paneli kaynak kodlarını yedekle
    const adminSourceCode = await createAdminSourceCodeBackup()
    
    // Ana site kaynak kodlarını yedekle
    const mainSourceCode = await createMainSourceCodeBackup()
    
    // Upload edilen dosyaları yedekle
    const uploadsBackup = await createUploadsBackup()

    // README oluştur
    const readmeContent = `# GRBT8 Backup - ${now.toLocaleString('tr-TR')}

## 📋 Yedek İçeriği

### 🗄️ Database Backup
- Admin paneli database dump
- Ana site database dump
- Tüm tablolar ve veriler

### ⚙️ Configuration Files
- Admin paneli konfigürasyonu
- Ana site konfigürasyonu
- Environment variables
- Database bağlantı bilgileri

### 💻 Source Code
- Admin paneli kaynak kodları (Next.js)
- Ana site kaynak kodları (Next.js)
- Tüm component'ler ve sayfalar
- API route'ları

### 📁 Uploaded Files
- Kullanıcı yüklenen dosyalar
- Campaign görselleri
- Logo ve icon'lar
- Tüm medya dosyaları

## 📊 Backup Detayları
- **Yedek Adı**: ${backupName}
- **Tarih**: ${now.toLocaleString('tr-TR')}
- **Boyut**: ${calculateTotalSize([databaseDump, configBackup, adminSourceCode, mainSourceCode, uploadsBackup])}
- **Dosya Sayısı**: ${countTotalFiles([databaseDump, configBackup, adminSourceCode, mainSourceCode, uploadsBackup])}

## 🔄 Restore İşlemi
Bu yedekten geri yükleme yapmak için:
1. Database dump'ları import edin
2. Config dosyalarını yerleştirin
3. Source code'ları deploy edin
4. Upload dosyalarını yükleyin

---
*Bu yedek otomatik olarak oluşturulmuştur.*
`

    // GitLab API ile dosyaları yükle
    const files = [
      { name: `database/${backupName}_admin_database.json`, content: JSON.stringify(databaseDump, null, 2) },
      { name: `database/${backupName}_main_database.json`, content: JSON.stringify(databaseDump, null, 2) },
      { name: `config/${backupName}_admin_config.json`, content: JSON.stringify(configBackup, null, 2) },
      { name: `config/${backupName}_main_config.json`, content: JSON.stringify(configBackup, null, 2) },
      { name: `source-code/${backupName}_admin_source.json`, content: JSON.stringify(adminSourceCode, null, 2) },
      { name: `source-code/${backupName}_main_source.json`, content: JSON.stringify(mainSourceCode, null, 2) },
      { name: `uploads/${backupName}_uploads.json`, content: JSON.stringify(uploadsBackup, null, 2) },
      { name: `README_${backupName}.md`, content: readmeContent }
    ]

    const uploadResults = []
    for (const file of files) {
      try {
        const response = await fetch(`https://gitlab.com/api/v4/projects/${PROJECT_ID}/repository/files/${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITLAB_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            branch: BRANCH,
            content: file.content,
            commit_message: `Backup: ${backupName} - ${file.name}`
          })
        })

        if (response.ok) {
          uploadResults.push({ file: file.name, status: '✅ Başarılı' })
        } else {
          const error = await response.text()
          uploadResults.push({ file: file.name, status: `❌ Hata: ${error}` })
        }
      } catch (error) {
        uploadResults.push({ file: file.name, status: `❌ Hata: ${error instanceof Error ? error.message : 'Unknown error'}` })
      }
    }

    // Eski yedekleri temizle (7 günden eski)
    await cleanupOldGitLabBackups(PROJECT_ID, GITLAB_TOKEN, BRANCH)

    return {
      success: true,
      message: 'GitLab yedekleme başarıyla tamamlandı',
      repository: `https://gitlab.com/depogrbt8-backup/grbt8ap-backup`,
      files: uploadResults,
      size: calculateTotalSize([databaseDump, configBackup, adminSourceCode, mainSourceCode, uploadsBackup]),
      timestamp: now.toISOString(),
      backupName: backupName
    }
  } catch (error) {
    console.error('GitLab yedekleme hatası:', error)
    return {
      success: false,
      error: 'GitLab yedekleme başarısız: ' + (error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

async function createRealDatabaseDump() {
  try {
    // Gerçek database dump oluştur
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    // Tüm tabloları al
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ` as Array<{ table_name: string }>
    
    const dump: any = {
      timestamp: new Date().toISOString(),
      database: 'grbt8_production',
      tables: {}
    }
    
    // Her tablo için verileri al
    for (const table of tables) {
      try {
        const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${table.table_name}"`)
        dump.tables[table.table_name] = data
      } catch (error) {
        console.log(`Tablo ${table.table_name} okunamadı:`, error)
        dump.tables[table.table_name] = []
      }
    }
    
    await prisma.$disconnect()
    return dump
  } catch (error) {
    console.error('Database dump hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      database: 'grbt8_production',
      error: 'Database dump oluşturulamadı',
      tables: {}
    }
  }
}

async function createRealConfigBackup() {
  try {
    const configBackup: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      configs: {}
    }
    
    // Admin paneli config dosyalarını oku
    const adminConfigPath = path.join(process.cwd(), 'lib', 'config.ts')
    if (fs.existsSync(adminConfigPath)) {
      configBackup.configs.admin_config = fs.readFileSync(adminConfigPath, 'utf8')
    }
    
    // Ana site config dosyalarını oku
    const mainConfigPath = path.join(process.cwd(), '..', 'grbt8', 'lib', 'config.ts')
    if (fs.existsSync(mainConfigPath)) {
      configBackup.configs.main_config = fs.readFileSync(mainConfigPath, 'utf8')
    }
    
    // Environment variables (güvenli olanlar)
    configBackup.configs.env_vars = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? '***HIDDEN***' : undefined,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '***HIDDEN***' : undefined,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL
    }
    
    return configBackup
  } catch (error) {
    console.error('Config backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      error: 'Config backup oluşturulamadı',
      configs: {}
    }
  }
}

async function createAdminSourceCodeBackup() {
  try {
    const sourceBackup: any = {
      timestamp: new Date().toISOString(),
      type: 'admin_panel',
      files: {}
    }
    
    // Admin paneli dosyalarını oku
    const adminDir = process.cwd()
    const importantFiles = [
      'package.json',
      'next.config.js',
      'tailwind.config.ts',
      'tsconfig.json',
      'middleware.ts'
    ]
    
    for (const file of importantFiles) {
      const filePath = path.join(adminDir, file)
      if (fs.existsSync(filePath)) {
        sourceBackup.files[file] = fs.readFileSync(filePath, 'utf8')
      }
    }
    
    // App klasörünü oku
    const appDir = path.join(adminDir, 'app')
    if (fs.existsSync(appDir)) {
      sourceBackup.files.app = await readDirectoryRecursively(appDir)
    }
    
    // Lib klasörünü oku
    const libDir = path.join(adminDir, 'lib')
    if (fs.existsSync(libDir)) {
      sourceBackup.files.lib = await readDirectoryRecursively(libDir)
    }
    
    return sourceBackup
  } catch (error) {
    console.error('Admin source code backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'admin_panel',
      error: 'Admin source code backup oluşturulamadı',
      files: {}
    }
  }
}

async function createMainSourceCodeBackup() {
  try {
    const sourceBackup: any = {
      timestamp: new Date().toISOString(),
      type: 'main_site',
      files: {}
    }
    
    // Ana site dosyalarını oku
    const mainDir = path.join(process.cwd(), '..', 'grbt8')
    if (!fs.existsSync(mainDir)) {
      return {
        timestamp: new Date().toISOString(),
        type: 'main_site',
        error: 'Ana site klasörü bulunamadı',
        files: {}
      }
    }
    
    const importantFiles = [
      'package.json',
      'next.config.js',
      'tailwind.config.ts',
      'tsconfig.json'
    ]
    
    for (const file of importantFiles) {
      const filePath = path.join(mainDir, file)
      if (fs.existsSync(filePath)) {
        sourceBackup.files[file] = fs.readFileSync(filePath, 'utf8')
      }
    }
    
    // Src klasörünü oku
    const srcDir = path.join(mainDir, 'src')
    if (fs.existsSync(srcDir)) {
      sourceBackup.files.src = await readDirectoryRecursively(srcDir)
    }
    
    return sourceBackup
  } catch (error) {
    console.error('Main source code backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'main_site',
      error: 'Main source code backup oluşturulamadı',
      files: {}
    }
  }
}

async function createUploadsBackup() {
  try {
    const uploadsBackup: any = {
      timestamp: new Date().toISOString(),
      type: 'uploads',
      files: {}
    }
    
    // Public uploads klasörünü oku
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (fs.existsSync(uploadsDir)) {
      uploadsBackup.files.uploads = await readDirectoryRecursively(uploadsDir, true) // base64 encoding
    }
    
    return uploadsBackup
  } catch (error) {
    console.error('Uploads backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'uploads',
      error: 'Uploads backup oluşturulamadı',
      files: {}
    }
  }
}

async function readDirectoryRecursively(dirPath: string, encodeBase64 = false): Promise<any> {
  const result: any = {}
  
  try {
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stat = fs.statSync(itemPath)
      
      if (stat.isDirectory()) {
        result[item] = await readDirectoryRecursively(itemPath, encodeBase64)
      } else {
        if (encodeBase64) {
          // Dosyayı base64 olarak encode et
          const content = fs.readFileSync(itemPath)
          result[item] = {
            content: content.toString('base64'),
            size: stat.size,
            type: path.extname(item)
          }
        } else {
          // Dosyayı text olarak oku
          try {
            result[item] = fs.readFileSync(itemPath, 'utf8')
          } catch (error) {
            result[item] = `[Binary file - ${stat.size} bytes]`
          }
        }
      }
    }
  } catch (error) {
    console.error(`Directory read error for ${dirPath}:`, error)
  }
  
  return result
}

function calculateTotalSize(backups: any[]): string {
  let totalSize = 0
  
  for (const backup of backups) {
    if (backup.files) {
      for (const [key, value] of Object.entries(backup.files)) {
        if (typeof value === 'string') {
          totalSize += value.length
        } else if (typeof value === 'object' && value !== null) {
          totalSize += JSON.stringify(value).length
        }
      }
    }
  }
  
  if (totalSize > 1024 * 1024) {
    return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
  } else if (totalSize > 1024) {
    return `${(totalSize / 1024).toFixed(2)} KB`
  } else {
    return `${totalSize} bytes`
  }
}

function countTotalFiles(backups: any[]): number {
  let count = 0
  
  for (const backup of backups) {
    if (backup.files) {
      count += countFilesRecursively(backup.files)
    }
  }
  
  return count
}

function countFilesRecursively(obj: any): number {
  let count = 0
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      count++
    } else if (typeof value === 'object' && value !== null) {
      count += countFilesRecursively(value)
    }
  }
  
  return count
}

async function cleanupOldGitLabBackups(projectId: string, token: string, branch: string) {
  try {
    // 7 günden eski yedekleri bul ve sil
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const response = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/repository/tree?ref=${branch}&recursive=true`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const files = await response.json()
      const oldBackups = files.filter((file: any) => 
        file.name.includes('backup_') && 
        file.name.includes('.json') &&
        new Date(file.last_activity_at) < sevenDaysAgo
      )
      
      for (const file of oldBackups) {
        try {
          await fetch(`https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(file.path)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: branch,
              commit_message: `Cleanup: Eski yedek silindi - ${file.name}`
            })
          })
        } catch (error) {
          console.log(`Eski yedek silinemedi: ${file.name}`)
        }
      }
    }
  } catch (error) {
    console.log('Eski yedek temizleme hatası:', error)
  }
}

function calculateNextBackup(schedule: string): string {
  // Basit cron parsing (sadece saat için)
  const parts = schedule.split(' ')
  const hour = parseInt(parts[1]) || 2
  
  const now = new Date()
  const nextBackup = new Date()
  nextBackup.setHours(hour, 0, 0, 0)
  
  if (nextBackup <= now) {
    nextBackup.setDate(nextBackup.getDate() + 1)
  }
  
  return nextBackup.toISOString()
}
