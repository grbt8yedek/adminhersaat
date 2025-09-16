import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Database bağlantısını test et
    console.log('Testing database connection...')
    
    // Önce Campaign tablosunun var olup olmadığını kontrol et
    const campaignCount = await prisma.campaign.count()
    console.log('Campaign count:', campaignCount)
    
    // İlk 3 kampanyayı getir
    const sampleCampaigns = await prisma.campaign.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true
      }
    })
    console.log('Sample campaigns:', sampleCampaigns)

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        campaignCount,
        sampleCampaigns,
        message: 'Database connection successful'
      }
    })

  } catch (error) {
    console.error('Database test hatası:', error)
    
    return NextResponse.json({
      success: false,
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined
      }
    })
  }
}
