import { NextRequest, NextResponse } from 'next/server'
import resendService from '@/app/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name } = body

    if (!email || !name) {
      return NextResponse.json({
        success: false,
        error: 'Email ve isim zorunludur'
      }, { status: 400 })
    }

    // Hoşgeldin emaili gönder
    const result = await resendService.sendWelcomeEmail(email, name)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Hoşgeldin emaili ${email} adresine gönderildi`,
        data: {
          messageId: result.messageId,
          recipient: email,
          template: 'welcome'
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Hoşgeldin email hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Email gönderilirken hata oluştu'
    }, { status: 500 })
  }
}
