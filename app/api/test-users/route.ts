import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Database bağlantısını test et
    const userCount = await prisma.user.count()
    
    // İlk 3 kullanıcıyı getir
    const sampleUsers = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        createdAt: true
      }
    })

    // Tablo bilgilerini al
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
      ORDER BY name
    ` as Array<{name: string}>

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        userCount,
        sampleUsers,
        tables: tables.map(t => t.name)
      }
    })

  } catch (error) {
    console.error('Database test hatası:', error)
    
    return NextResponse.json({
      success: false,
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    })
  }
}
