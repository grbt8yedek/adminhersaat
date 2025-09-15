import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// Logger fonksiyonu - Prisma hatası durumunda boş fonksiyon
async function safeCreateLog(logData: any) {
  try {
    const { createLog } = await import('@/app/lib/logger')
    await createLog(logData)
  } catch (error) {
    console.log('Log kaydedilemedi:', logData.message)
  }
}

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
        await safeCreateLog({
          level: 'INFO',
          message: 'Manuel yedekleme oluşturuldu',
          source: 'backup',
          metadata: {
            backupPath: result.path,
            size: 'N/A'
          }
        })
      }

      return NextResponse.json(result)
    }

    if (action === 'gitlab') {
      // GitLab'a yedekleme oluştur
      const result = await createGitLabBackup()

      if (result.success) {
        await safeCreateLog({
          level: 'INFO',
          message: 'GitLab yedekleme oluşturuldu',
          source: 'backup-gitlab',
          metadata: {
            repository: result.repository,
            files: result.files,
            size: 'N/A'
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
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD format
    const backupName = `backup_${dateStr}`

    // GitLab bilgileri (hardcoded for now)
    const GITLAB_TOKEN = 'glpat-KYIkNq_KQtxWTvd5vRMxvG86MQp1OmkwanlyCw.01.120j4le7y'
    const PROJECT_ID = 'depogrbt8-backup%2Fgrbt8ap-backup'
    const BRANCH = 'main'

    // Yeni yapıya göre yedekleme oluştur
    const uploadResults = []

    // 1. Admin Panel yedekleme
    console.log('Admin paneli yedekleniyor...')
    const adminBackup = await createStructuredAdminBackup()
    for (const [filePath, content] of Object.entries(adminBackup.files)) {
      const result = await uploadFileToGitLab(
        `admin-panel/${filePath}`,
        content,
        backupName,
        PROJECT_ID,
        GITLAB_TOKEN,
        BRANCH
      )
      uploadResults.push(result)
    }

    // 2. Ana Site yedekleme
    console.log('Ana site yedekleniyor...')
    const mainBackup = await createStructuredMainBackup()
    for (const [filePath, content] of Object.entries(mainBackup.files)) {
      const result = await uploadFileToGitLab(
        `ana-site/${filePath}`,
        content,
        backupName,
        PROJECT_ID,
        GITLAB_TOKEN,
        BRANCH
      )
      uploadResults.push(result)
    }

    // 3. Database yedekleme
    console.log('Database yedekleniyor...')
    const databaseDump = await createRealDatabaseDump()
    const dbResult = await uploadFileToGitLab(
      `database/${backupName}_database.json`,
      JSON.stringify(databaseDump, null, 2),
      backupName,
      PROJECT_ID,
      GITLAB_TOKEN,
      BRANCH
    )
    uploadResults.push(dbResult)

    // 4. Uploads yedekleme
    console.log('Upload dosyaları yedekleniyor...')
    const uploadsBackup = await createStructuredUploadsBackup()
    for (const [filePath, content] of Object.entries(uploadsBackup.files)) {
      const result = await uploadFileToGitLab(
        `uploads/${filePath}`,
        content,
        backupName,
        PROJECT_ID,
        GITLAB_TOKEN,
        BRANCH
      )
      uploadResults.push(result)
    }

    // 5. README oluştur
    const readmeContent = `# GRBT8 Backup - ${now.toLocaleString('tr-TR')}

## 📋 Yedek İçeriği

Bu yedek şu klasör yapısında organize edilmiştir:

### 📁 admin-panel/
Admin paneli kaynak kodları ve konfigürasyon dosyaları
- \`package.json\` - Bağımlılıklar
- \`next.config.js\` - Next.js konfigürasyonu
- \`app/\` - Sayfalar ve API route'ları
- \`lib/\` - Yardımcı fonksiyonlar
- \`components/\` - React component'leri

### 📁 ana-site/
Ana site kaynak kodları ve konfigürasyon dosyaları
- \`package.json\` - Bağımlılıklar
- \`next.config.js\` - Next.js konfigürasyonu
- \`src/\` - Kaynak kodlar
- \`app/\` - Sayfalar
- \`components/\` - React component'leri

### 📁 database/
Veritabanı yedekleme dosyası
- \`${backupName}_database.json\` - Tüm tablolar ve veriler

### 📁 uploads/
Yüklenen dosyalar
- Kullanıcı yüklenen dosyalar
- Campaign görselleri
- Logo ve icon'lar
- Tüm medya dosyaları

## 📊 Backup Detayları
- **Yedek Adı**: ${backupName}
- **Tarih**: ${now.toLocaleString('tr-TR')}
- **Dosya Sayısı**: ${uploadResults.length}
- **Başarılı**: ${uploadResults.filter(r => r.status.includes('✅')).length}
- **Hatalı**: ${uploadResults.filter(r => r.status.includes('❌')).length}

## 🔄 Restore İşlemi
Bu yedekten geri yükleme yapmak için:

1. **Admin Panel**: \`admin-panel/\` klasörünü kopyalayın
2. **Ana Site**: \`ana-site/\` klasörünü kopyalayın
3. **Database**: \`database/${backupName}_database.json\` dosyasını import edin
4. **Uploads**: \`uploads/\` klasörünü \`public/\` altına kopyalayın

## 📝 Notlar
- Bu yedek otomatik olarak oluşturulmuştur
- Dosyalar base64 formatında saklanmıştır
- Geri yükleme işlemi için gerekli bağımlılıkları yüklemeyi unutmayın

---
*GRBT8 Otomatik Yedekleme Sistemi*
`

    const readmeResult = await uploadFileToGitLab(
      `README_${backupName}.md`,
      readmeContent,
      backupName,
      PROJECT_ID,
      GITLAB_TOKEN,
      BRANCH
    )
    uploadResults.push(readmeResult)

    // Eski yedekleri temizle (7 günden eski)
    await cleanupOldGitLabBackups(PROJECT_ID, GITLAB_TOKEN, BRANCH)

    return {
      success: true,
      message: 'GitLab yedekleme başarıyla tamamlandı',
      repository: `https://gitlab.com/depogrbt8-backup/grbt8ap-backup`,
      files: uploadResults,
      timestamp: now.toISOString(),
      backupName: backupName,
      structure: {
        'admin-panel': 'Admin paneli kaynak kodları',
        'ana-site': 'Ana site kaynak kodları', 
        'database': 'Veritabanı yedekleme',
        'uploads': 'Yüklenen dosyalar'
      }
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
      error: 'Database dump oluşturulamadı - Prisma client hatası',
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

async function createStructuredAdminBackup() {
  try {
    const adminDir = process.cwd()
    const files: { [key: string]: string } = {}
    
    // Ana konfigürasyon dosyaları
    const configFiles = [
      'package.json',
      'next.config.js',
      'tailwind.config.ts',
      'tsconfig.json',
      'middleware.ts',
      'postcss.config.js'
    ]
    
    for (const file of configFiles) {
      const filePath = path.join(adminDir, file)
      if (fs.existsSync(filePath)) {
        files[file] = fs.readFileSync(filePath, 'utf8')
      }
    }
    
    // App klasörünü yapılandırılmış şekilde oku
    const appDir = path.join(adminDir, 'app')
    if (fs.existsSync(appDir)) {
      const appFiles = await readDirectoryAsFiles(appDir)
      Object.assign(files, appFiles)
    }
    
    // Lib klasörünü yapılandırılmış şekilde oku
    const libDir = path.join(adminDir, 'lib')
    if (fs.existsSync(libDir)) {
      const libFiles = await readDirectoryAsFiles(libDir)
      Object.assign(files, libFiles)
    }
    
    // Components klasörünü yapılandırılmış şekilde oku
    const componentsDir = path.join(adminDir, 'app', 'components')
    if (fs.existsSync(componentsDir)) {
      const componentFiles = await readDirectoryAsFiles(componentsDir)
      Object.assign(files, componentFiles)
    }
    
    return {
      timestamp: new Date().toISOString(),
      type: 'admin_panel',
      files: files
    }
  } catch (error) {
    console.error('Admin structured backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'admin_panel',
      error: 'Admin structured backup oluşturulamadı',
      files: {}
    }
  }
}

async function createStructuredMainBackup() {
  try {
    const mainDir = path.join(process.cwd(), '..', 'grbt8')
    if (!fs.existsSync(mainDir)) {
      return {
        timestamp: new Date().toISOString(),
        type: 'main_site',
        error: 'Ana site klasörü bulunamadı',
        files: {}
      }
    }
    
    const files: { [key: string]: string } = {}
    
    // Ana konfigürasyon dosyaları
    const configFiles = [
      'package.json',
      'next.config.js',
      'tailwind.config.ts',
      'tsconfig.json',
      'postcss.config.js'
    ]
    
    for (const file of configFiles) {
      const filePath = path.join(mainDir, file)
      if (fs.existsSync(filePath)) {
        files[file] = fs.readFileSync(filePath, 'utf8')
      }
    }
    
    // Src klasörünü yapılandırılmış şekilde oku
    const srcDir = path.join(mainDir, 'src')
    if (fs.existsSync(srcDir)) {
      const srcFiles = await readDirectoryAsFiles(srcDir)
      Object.assign(files, srcFiles)
    }
    
    // App klasörünü yapılandırılmış şekilde oku (eğer varsa)
    const appDir = path.join(mainDir, 'app')
    if (fs.existsSync(appDir)) {
      const appFiles = await readDirectoryAsFiles(appDir)
      Object.assign(files, appFiles)
    }
    
    return {
      timestamp: new Date().toISOString(),
      type: 'main_site',
      files: files
    }
  } catch (error) {
    console.error('Main structured backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'main_site',
      error: 'Main structured backup oluşturulamadı',
      files: {}
    }
  }
}

async function createStructuredUploadsBackup() {
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      return {
        timestamp: new Date().toISOString(),
        type: 'uploads',
        error: 'Uploads klasörü bulunamadı',
        files: {}
      }
    }
    
    const files: { [key: string]: string } = {}
    const uploadFiles = await readDirectoryAsFiles(uploadsDir, true) // base64 encoding
    Object.assign(files, uploadFiles)
    
    return {
      timestamp: new Date().toISOString(),
      type: 'uploads',
      files: files
    }
  } catch (error) {
    console.error('Uploads structured backup hatası:', error)
    return {
      timestamp: new Date().toISOString(),
      type: 'uploads',
      error: 'Uploads structured backup oluşturulamadı',
      files: {}
    }
  }
}

async function uploadFileToGitLab(filePath: string, content: string, backupName: string, projectId: string, token: string, branch: string) {
  try {
    const response = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: branch,
        content: content,
        commit_message: `Backup: ${backupName} - ${filePath}`
      })
    })

    if (response.ok) {
      return { file: filePath, status: '✅ Başarılı' }
    } else {
      const error = await response.text()
      return { file: filePath, status: `❌ Hata: ${error}` }
    }
  } catch (error) {
    return { file: filePath, status: `❌ Hata: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

async function readDirectoryAsFiles(dirPath: string, encodeBase64 = false): Promise<{ [key: string]: string }> {
  const files: { [key: string]: string } = {}
  
  try {
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stat = fs.statSync(itemPath)
      
      if (stat.isDirectory()) {
        // Alt klasörleri de dahil et
        const subFiles = await readDirectoryAsFiles(itemPath, encodeBase64)
        for (const [subPath, content] of Object.entries(subFiles)) {
          files[`${item}/${subPath}`] = content
        }
      } else {
        const relativePath = path.relative(dirPath, itemPath)
        if (encodeBase64) {
          // Dosyayı base64 olarak encode et
          const content = fs.readFileSync(itemPath)
          files[relativePath] = content.toString('base64')
        } else {
          // Dosyayı text olarak oku
          try {
            files[relativePath] = fs.readFileSync(itemPath, 'utf8')
          } catch (error) {
            files[relativePath] = `[Binary file - ${stat.size} bytes]`
          }
        }
      }
    }
  } catch (error) {
    console.error(`Directory read error for ${dirPath}:`, error)
  }
  
  return files
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
        (file.name.includes('backup_') && file.name.includes('.json')) ||
        (file.name.includes('backup_') && file.name.includes('.md')) ||
        (file.path.includes('admin-panel/') && file.name.includes('backup_')) ||
        (file.path.includes('ana-site/') && file.name.includes('backup_')) ||
        (file.path.includes('database/') && file.name.includes('backup_')) ||
        (file.path.includes('uploads/') && file.name.includes('backup_'))
      )
      
      // Dosyaları tarihe göre grupla
      const backupGroups: { [key: string]: any[] } = {}
      for (const file of oldBackups) {
        const backupDate = file.name.match(/backup_(\d{4}-\d{2}-\d{2})/)
        if (backupDate) {
          const date = backupDate[1]
          if (!backupGroups[date]) {
            backupGroups[date] = []
          }
          backupGroups[date].push(file)
        }
      }
      
      // 7 günden eski backup gruplarını sil
      for (const [date, files] of Object.entries(backupGroups)) {
        const backupDate = new Date(date)
        if (backupDate < sevenDaysAgo) {
          console.log(`Eski yedek grubu siliniyor: ${date} (${files.length} dosya)`)
          
          for (const file of files) {
            try {
              await fetch(`https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(file.path)}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  branch: branch,
                  commit_message: `Cleanup: Eski yedek grubu silindi - ${date}`
                })
              })
            } catch (error) {
              console.log(`Eski yedek silinemedi: ${file.name}`)
            }
          }
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
