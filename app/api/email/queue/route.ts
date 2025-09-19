import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const priority = searchParams.get('priority') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Database'den gerçek kuyruk verilerini çek
    const whereConditions: any = {}
    
    if (status !== 'all') {
      whereConditions.status = status
    }
    
    if (priority !== 'all') {
      whereConditions.priority = priority
    }

    const emailQueue = await prisma.emailQueue.findMany({
      where: whereConditions,
      orderBy: [
        { priority: 'desc' }, // high, normal, low
        { scheduledAt: 'asc' },
        { createdAt: 'asc' }
      ],
      take: limit,
      include: {
        template: {
          select: {
            name: true,
            type: true
          }
        }
      }
    })

    // Kuyruk istatistikleri - gerçek verilerden hesapla
    const allQueueItems = await prisma.emailQueue.findMany()
    const queueStats = {
      total: allQueueItems.length,
      pending: allQueueItems.filter(item => item.status === 'pending').length,
      processing: allQueueItems.filter(item => item.status === 'processing').length,
      failed: allQueueItems.filter(item => item.status === 'failed').length,
      completed: allQueueItems.filter(item => item.status === 'completed').length,
      highPriority: allQueueItems.filter(item => item.priority === 'high').length,
      normalPriority: allQueueItems.filter(item => item.priority === 'normal').length,
      lowPriority: allQueueItems.filter(item => item.priority === 'low').length,
      retryNeeded: allQueueItems.filter(item => item.status === 'failed' && item.retryCount < 3).length
    }

    // Mock data yerine gerçek data formatla
    const formattedQueue = emailQueue.map(item => ({
      id: item.id,
      recipientEmail: item.recipient,
      subject: item.subject,
      templateId: item.templateId,
      templateName: item.template?.name || 'Bilinmeyen Template',
      priority: item.priority,
      status: item.status,
      scheduledAt: item.scheduledAt?.toISOString(),
      createdAt: item.createdAt.toISOString(),
      sentAt: item.sentAt?.toISOString(),
      retryCount: item.retryCount,
      maxRetries: 3,
      errorMessage: item.errorMessage
    }))

    return NextResponse.json({
      success: true,
      data: {
        queue: formattedQueue,
        stats: queueStats
      }
    })

  } catch (error: any) {
    console.error('Email kuyruk hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Email kuyruğu alınamadı'
    }, { status: 500 })
  }
}

// MOCK DATA KALDIRDIK - Gerçek database kullanıyoruz artık
export async function GET_OLD_MOCK() {
  try {
    // Email kuyruğu verileri - ESKI MOCK DATA
    const emailQueue = [
      {
        id: 'queue_001',
        emailId: 'email_006',
        recipientEmail: 'ahmet@example.com',
        recipientName: 'Ahmet Yıldız',
        subject: 'Newsletter\'a Hoş Geldiniz!',
        templateId: '14',
        templateName: 'Newsletter Aboneliği',
        priority: 'normal',
        scheduledAt: '2024-01-15T12:00:00Z',
        createdAt: '2024-01-15T11:45:00Z',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        userId: 'user_111',
        campaignId: 'campaign_003',
        variables: {
          userName: 'Ahmet Yıldız',
          siteName: 'GurbetBiz'
        }
      },
      {
        id: 'queue_002',
        emailId: 'email_007',
        recipientEmail: 'zeynep@example.com',
        recipientName: 'Zeynep Arslan',
        subject: 'Bagaj Bilgileriniz - DEF456',
        templateId: '16',
        templateName: 'Bagaj Bilgilendirmesi',
        priority: 'high',
        scheduledAt: '2024-01-15T11:30:00Z',
        createdAt: '2024-01-15T11:25:00Z',
        status: 'processing',
        retryCount: 0,
        maxRetries: 3,
        userId: 'user_222',
        campaignId: null,
        variables: {
          userName: 'Zeynep Arslan',
          pnr: 'DEF456',
          handBaggage: '8',
          cabinBaggage: '23'
        }
      },
      {
        id: 'queue_003',
        emailId: 'email_008',
        recipientEmail: 'emre@example.com',
        recipientName: 'Emre Çelik',
        subject: 'Seyahat Sigortası Önerisi - Roma',
        templateId: '18',
        templateName: 'Seyahat Sigortası',
        priority: 'low',
        scheduledAt: '2024-01-15T13:00:00Z',
        createdAt: '2024-01-15T11:50:00Z',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        userId: 'user_333',
        campaignId: 'campaign_004',
        variables: {
          userName: 'Emre Çelik',
          destination: 'Roma',
          standardPrice: '25',
          premiumPrice: '45',
          vipPrice: '75'
        }
      },
      {
        id: 'queue_004',
        emailId: 'email_009',
        recipientEmail: 'seda@example.com',
        recipientName: 'Seda Öztürk',
        subject: 'Ödeme İşlemi Başarısız - GHI789',
        templateId: '7',
        templateName: 'Ödeme Hatası',
        priority: 'high',
        scheduledAt: '2024-01-15T11:20:00Z',
        createdAt: '2024-01-15T11:15:00Z',
        status: 'failed',
        retryCount: 2,
        maxRetries: 3,
        userId: 'user_444',
        campaignId: null,
        variables: {
          userName: 'Seda Öztürk',
          pnr: 'GHI789',
          errorReason: 'Kart limiti aşıldı'
        }
      },
      {
        id: 'queue_005',
        emailId: 'email_010',
        recipientEmail: 'can@example.com',
        recipientName: 'Can Şahin',
        subject: 'Otel Rezervasyon Onayı - Grand Hotel',
        templateId: '19',
        templateName: 'Otel Rezervasyonu',
        priority: 'normal',
        scheduledAt: '2024-01-15T12:30:00Z',
        createdAt: '2024-01-15T12:00:00Z',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        userId: 'user_555',
        campaignId: null,
        variables: {
          userName: 'Can Şahin',
          hotelName: 'Grand Hotel',
          checkInDate: '2024-01-20',
          checkOutDate: '2024-01-25',
          nights: '5'
        }
      }
    ]

    // Kuyruk istatistikleri
    const queueStats = {
      total: emailQueue.length,
      pending: emailQueue.filter(item => item.status === 'pending').length,
      processing: emailQueue.filter(item => item.status === 'processing').length,
      failed: emailQueue.filter(item => item.status === 'failed').length,
      completed: emailQueue.filter(item => item.status === 'completed').length,
      highPriority: emailQueue.filter(item => item.priority === 'high').length,
      normalPriority: emailQueue.filter(item => item.priority === 'normal').length,
      lowPriority: emailQueue.filter(item => item.priority === 'low').length,
      retryNeeded: emailQueue.filter(item => item.status === 'failed' && item.retryCount < item.maxRetries).length
    }

    return NextResponse.json({
      success: true,
      data: {
        queue: emailQueue,
        stats: queueStats
      }
    })

  } catch (error: any) {
    console.error('Email kuyruk hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Email kuyruğu alınamadı'
    }, { status: 500 })
  }
}

// Kuyruk işlemleri - Gerçek database operasyonları
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, queueId, emailId, priority, scheduledAt, recipient, subject, content, templateId } = body

    switch (action) {
      case 'add':
        // Yeni email kuyruğa ekle
        const newQueueItem = await prisma.emailQueue.create({
          data: {
            recipient,
            subject,
            content,
            templateId,
            priority: priority || 'normal',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
            status: 'pending'
          }
        })
        return NextResponse.json({
          success: true,
          message: 'Email kuyruğa eklendi',
          data: newQueueItem
        })

      case 'retry':
        // Başarısız email'i tekrar dene
        if (!queueId) {
          return NextResponse.json({
            success: false,
            error: 'Queue ID gereklidir'
          }, { status: 400 })
        }

        await prisma.emailQueue.update({
          where: { id: queueId },
          data: {
            status: 'pending',
            retryCount: { increment: 1 },
            errorMessage: null,
            scheduledAt: new Date() // Hemen gönder
          }
        })
        
        return NextResponse.json({
          success: true,
          message: 'Email tekrar kuyruğa alındı'
        })

      case 'cancel':
        // Email'i kuyruktan çıkar
        if (!queueId) {
          return NextResponse.json({
            success: false,
            error: 'Queue ID gereklidir'
          }, { status: 400 })
        }

        await prisma.emailQueue.update({
          where: { id: queueId },
          data: {
            status: 'cancelled'
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Email kuyruktan çıkarıldı'
        })

      case 'priority':
        // Öncelik değiştir
        if (!queueId || !priority) {
          return NextResponse.json({
            success: false,
            error: 'Queue ID ve priority gereklidir'
          }, { status: 400 })
        }

        await prisma.emailQueue.update({
          where: { id: queueId },
          data: { priority }
        })

        return NextResponse.json({
          success: true,
          message: 'Email önceliği güncellendi'
        })

      case 'schedule':
        // Zamanlama değiştir
        if (!queueId || !scheduledAt) {
          return NextResponse.json({
            success: false,
            error: 'Queue ID ve scheduledAt gereklidir'
          }, { status: 400 })
        }

        await prisma.emailQueue.update({
          where: { id: queueId },
          data: {
            scheduledAt: new Date(scheduledAt)
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Email zamanlaması güncellendi'
        })

      case 'process':
        // Kuyruktaki emailları işle (cron job için)
        const pendingEmails = await prisma.emailQueue.findMany({
          where: {
            status: 'pending',
            scheduledAt: {
              lte: new Date()
            }
          },
          orderBy: [
            { priority: 'desc' },
            { scheduledAt: 'asc' }
          ],
          take: 10 // Aynı anda max 10 email işle
        })

        let processedCount = 0
        for (const email of pendingEmails) {
          try {
            // Email'i processing olarak işaretle
            await prisma.emailQueue.update({
              where: { id: email.id },
              data: { status: 'processing' }
            })

            // Burada gerçek email gönderimi yapılacak
            // Resend API çağrısı vs.
            
            // Başarılı olursa completed olarak işaretle
            await prisma.emailQueue.update({
              where: { id: email.id },
              data: { 
                status: 'completed',
                sentAt: new Date()
              }
            })

            processedCount++
          } catch (emailError) {
            // Başarısız olursa failed olarak işaretle
            await prisma.emailQueue.update({
              where: { id: email.id },
              data: { 
                status: 'failed',
                errorMessage: String(emailError)
              }
            })
          }
        }

        return NextResponse.json({
          success: true,
          message: `${processedCount} email işlendi`,
          processed: processedCount
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Geçersiz işlem'
        }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Email kuyruk işlem hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'İşlem gerçekleştirilemedi: ' + error.message
    }, { status: 500 })
  }
}