export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string
}

export class ResendEmailService {
  private static instance: ResendEmailService
  private defaultFrom: string = 'noreply@resend.dev'

  private constructor() {}

  static getInstance(): ResendEmailService {
    if (!ResendEmailService.instance) {
      ResendEmailService.instance = new ResendEmailService()
    }
    return ResendEmailService.instance
  }

  async sendEmail(options: EmailOptions) {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY environment variable bulunamadı')
      }

      const { to, subject, html, text, from, cc, bcc, replyTo } = options

      const payload = {
        from: from || this.defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || text,
        text,
        cc,
        bcc,
        reply_to: replyTo
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Resend API hatası')
      }

      return {
        success: true,
        data: result,
        messageId: result.id
      }
    } catch (error: any) {
      console.error('Resend email gönderme hatası:', error)
      return {
        success: false,
        error: error.message || 'Email gönderilemedi'
      }
    }
  }

  // Hoşgeldin emaili template'i
  async sendWelcomeEmail(userEmail: string, userName: string) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Hoşgeldiniz - GRBT8</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Hoşgeldiniz ${userName}!</h1>
        </div>
        <div class="content">
          <h2>GRBT8'e Katıldığınız İçin Teşekkürler!</h2>
          <p>Merhaba <strong>${userName}</strong>,</p>
          <p>GRBT8 ailesine hoşgeldiniz! Hesabınız başarıyla oluşturuldu ve artık tüm hizmetlerimizden faydalanabilirsiniz.</p>
          
          <h3>✈️ Neler Yapabilirsiniz:</h3>
          <ul>
            <li>En uygun uçak biletlerini arayın</li>
            <li>Rezervasyonlarınızı yönetin</li>
            <li>Özel indirimlerden haberdar olun</li>
            <li>Seyahat geçmişinizi takip edin</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://www.grbt8.store/dashboard" class="button">Hesabıma Git</a>
          </div>

          <p>Herhangi bir sorunuz olursa, bizimle iletişime geçmekten çekinmeyin.</p>
          <p>İyi seyahatler dileriz! 🌟</p>
        </div>
        <div class="footer">
          <p>© 2024 GRBT8. Tüm hakları saklıdır.</p>
          <p>Bu email otomatik olarak gönderilmiştir.</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: userEmail,
      subject: `🎉 Hoşgeldiniz ${userName} - GRBT8'e Katıldınız!`,
      html
    })
  }

  // Rezervasyon onay emaili template'i
  async sendReservationConfirmation(userEmail: string, userName: string, reservationData: any) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Rezervasyon Onayı - GRBT8</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .reservation-box { background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .flight-info { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Rezervasyonunuz Onaylandı!</h1>
        </div>
        <div class="content">
          <p>Merhaba <strong>${userName}</strong>,</p>
          <p>Rezervasyonunuz başarıyla onaylandı. Detaylar aşağıdadır:</p>
          
          <div class="reservation-box">
            <h3>🎫 Rezervasyon Detayları</h3>
            <p><strong>Rezervasyon No:</strong> ${reservationData.reservationNumber || 'RES-' + Date.now()}</p>
            <p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
            <p><strong>Durum:</strong> <span style="color: #059669;">Onaylandı</span></p>
          </div>

          <p>Rezervasyon detaylarınızı hesabınızdan görüntüleyebilir ve gerekli işlemleri yapabilirsiniz.</p>
          <p>İyi seyahatler dileriz! ✈️</p>
        </div>
        <div class="footer">
          <p>© 2024 GRBT8. Tüm hakları saklıdır.</p>
          <p>Bu email otomatik olarak gönderilmiştir.</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: userEmail,
      subject: `✅ Rezervasyonunuz Onaylandı - ${reservationData.reservationNumber || 'RES-' + Date.now()}`,
      html
    })
  }

  // Sistem bildirimi emaili
  async sendSystemNotification(userEmail: string, title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') {
    const colors = {
      info: '#2563eb',
      warning: '#f59e0b',
      error: '#dc2626'
    }

    const icons = {
      info: '🔔',
      warning: '⚠️',
      error: '❌'
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title} - GRBT8</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${colors[type]}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${icons[type]} ${title}</h1>
        </div>
        <div class="content">
          <p>${message}</p>
          <p>GRBT8 Ekibi</p>
        </div>
        <div class="footer">
          <p>© 2024 GRBT8. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: userEmail,
      subject: `${icons[type]} ${title} - GRBT8`,
      html
    })
  }
}

export default ResendEmailService.getInstance()
