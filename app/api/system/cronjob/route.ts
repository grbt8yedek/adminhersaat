import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schedule } = body

    if (!schedule || typeof schedule !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz zaman formatı'
      }, { status: 400 })
    }

    // Cron formatını doğrula (basit kontrol)
    const cronPattern = /^(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)$/
    if (!cronPattern.test(schedule)) {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz cron formatı. Örnek: 0 16 * * *'
      }, { status: 400 })
    }

    // Vercel.json dosyasını oku
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json')
    
    if (!fs.existsSync(vercelConfigPath)) {
      return NextResponse.json({
        success: false,
        error: 'vercel.json dosyası bulunamadı'
      }, { status: 500 })
    }

    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))

    // GitLab cronjob'ını bul ve güncelle
    if (vercelConfig.crons && Array.isArray(vercelConfig.crons)) {
      const gitlabCronIndex = vercelConfig.crons.findIndex((cron: any) => 
        cron.path === '/api/system/backup'
      )

      if (gitlabCronIndex !== -1) {
        // Mevcut GitLab cronjob'ını güncelle
        vercelConfig.crons[gitlabCronIndex].schedule = schedule
        console.log(`✅ GitLab cronjob güncellendi: ${schedule}`)
      } else {
        // Yeni GitLab cronjob ekle
        vercelConfig.crons.push({
          path: '/api/system/backup',
          schedule: schedule
        })
        console.log(`✅ Yeni GitLab cronjob eklendi: ${schedule}`)
      }
    } else {
      // Crons array yoksa oluştur
      vercelConfig.crons = [
        {
          path: '/api/backup/auto',
          schedule: '0 */6 * * *'
        },
        {
          path: '/api/system/backup',
          schedule: schedule
        }
      ]
      console.log(`✅ Crons array oluşturuldu: ${schedule}`)
    }

    // Vercel.json dosyasını güncelle
    fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2))

    // Log kaydet
    try {
      const { createLog } = await import('@/app/lib/logger')
      await createLog({
        level: 'INFO',
        message: `GitLab cronjob zamanı güncellendi: ${schedule}`,
        source: 'cronjob-update',
        metadata: {
          oldSchedule: '0 14 * * *', // Bu değer database'den alınabilir
          newSchedule: schedule,
          timestamp: new Date().toISOString()
        }
      })
    } catch (logError) {
      console.log('Log kaydedilemedi:', logError)
    }

    return NextResponse.json({
      success: true,
      message: `GitLab cronjob zamanı güncellendi: ${schedule}`,
      schedule: schedule,
      note: 'Değişiklik deploy edildiğinde aktif olacak'
    })

  } catch (error) {
    console.error('Cronjob güncelleme hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Cronjob güncellenemedi: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Mevcut cronjob zamanını oku
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json')
    
    if (!fs.existsSync(vercelConfigPath)) {
      return NextResponse.json({
        success: false,
        error: 'vercel.json dosyası bulunamadı'
      }, { status: 500 })
    }

    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
    
    // GitLab cronjob'ını bul
    const gitlabCron = vercelConfig.crons?.find((cron: any) => 
      cron.path === '/api/system/backup'
    )

    return NextResponse.json({
      success: true,
      data: {
        schedule: gitlabCron?.schedule || '0 14 * * *',
        path: '/api/system/backup',
        description: 'GitLab otomatik yedekleme zamanı'
      }
    })

  } catch (error) {
    console.error('Cronjob okuma hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Cronjob bilgisi alınamadı'
    }, { status: 500 })
  }
}
