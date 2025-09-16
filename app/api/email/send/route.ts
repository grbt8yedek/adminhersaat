import { NextResponse } from 'next/server'
import resendService from '@/app/lib/resend'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      recipientType, 
      recipientEmail, 
      recipientEmails,
      to,
      subject, 
      content, 
      cc, 
      bcc, 
      templateId, 
      priority, 
      scheduledAt 
    } = body

    // Validation
    if (!subject || !content) {
      return NextResponse.json({
        success: false,
        error: 'Konu ve içerik zorunludur'
      }, { status: 400 })
    }

    // Alıcı email'leri belirle
    let recipients: string[] = []
    if (recipientType === 'bulk' && recipientEmails) {
      try {
        recipients = JSON.parse(recipientEmails)
      } catch {
        recipients = []
      }
    } else if (recipientType === 'single' && (to || recipientEmail)) {
      recipients = [to || recipientEmail]
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'En az bir alıcı belirtilmelidir'
      }, { status: 400 })
    }

    // Resend API key kontrolü
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
      // API key yoksa simülasyon modu
      console.log('🔄 RESEND_API_KEY bulunamadı, simülasyon modunda çalışıyor')
      
      const result = {
        success: true,
        message: recipientType === 'bulk' 
          ? `${recipients.length} kişiye email başarıyla kuyruğa alındı (simülasyon)`
          : 'Email başarıyla kuyruğa alındı (simülasyon)',
        data: {
          emailId: Date.now().toString(),
          status: 'simulated',
          estimatedDelivery: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          recipientCount: recipients.length,
          recipients: recipients
        }
      }
      return NextResponse.json(result)
    }

    // Gerçek email gönderimi
    const emailResults = []
    let successCount = 0
    let errorCount = 0

    for (const recipient of recipients) {
      try {
        const result = await resendService.sendEmail({
          to: recipient,
          subject,
          html: content,
          cc: cc ? [cc] : undefined,
          bcc: bcc ? [bcc] : undefined
        })

        emailResults.push({
          recipient,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        })

        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error: any) {
        emailResults.push({
          recipient,
          success: false,
          error: error.message
        })
        errorCount++
      }
    }

    const result = {
      success: successCount > 0,
      message: recipientType === 'bulk' 
        ? `${successCount}/${recipients.length} email başarıyla gönderildi`
        : successCount > 0 ? 'Email başarıyla gönderildi' : 'Email gönderilemedi',
      data: {
        emailId: Date.now().toString(),
        status: successCount > 0 ? 'sent' : 'failed',
        recipientCount: recipients.length,
        successCount,
        errorCount,
        results: emailResults
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Email gönderme hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Email gönderilirken hata oluştu'
    }, { status: 500 })
  }
}