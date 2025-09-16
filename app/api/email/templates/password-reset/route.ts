import { NextRequest, NextResponse } from 'next/server'
import resendService from '@/app/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, resetToken } = body

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email zorunludur'
      }, { status: 400 })
    }

    const resetLink = `https://www.grbt8.store/reset-password?token=${resetToken || 'sample-token'}`

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Şifre Sıfırlama - GRBT8</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Şifre Sıfırlama Talebi</h1>
        </div>
        <div class="content">
          <p>Merhaba${name ? ` <strong>${name}</strong>` : ''},</p>
          
          <p>GRBT8 hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
          
          <div class="warning">
            <p><strong>⚠️ Güvenlik Uyarısı:</strong></p>
            <p>Bu talebi siz yapmadıysanız, bu emaili görmezden gelin ve hesabınızın güvenliği için şifrenizi değiştirin.</p>
          </div>

          <p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>

          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Şifremi Sıfırla</a>
          </div>

          <p>Yukarıdaki buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırın:</p>
          <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
            ${resetLink}
          </p>

          <p><strong>Önemli Bilgiler:</strong></p>
          <ul>
            <li>Bu link 1 saat süreyle geçerlidir</li>
            <li>Tek kullanımlıktır</li>
            <li>Güvenliğiniz için linki kimseyle paylaşmayın</li>
          </ul>

          <p>Herhangi bir sorunuz olursa bizimle iletişime geçin.</p>
          <p>GRBT8 Ekibi</p>
        </div>
        <div class="footer">
          <p>© 2024 GRBT8. Tüm hakları saklıdır.</p>
          <p>Bu email otomatik olarak gönderilmiştir.</p>
        </div>
      </div>
    </body>
    </html>
    `

    const result = await resendService.sendEmail({
      to: email,
      subject: '🔐 Şifre Sıfırlama Talebi - GRBT8',
      html
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Şifre sıfırlama emaili ${email} adresine gönderildi`,
        data: {
          messageId: result.messageId,
          recipient: email,
          template: 'password-reset',
          resetLink
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Şifre sıfırlama email hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Email gönderilirken hata oluştu'
    }, { status: 500 })
  }
}
