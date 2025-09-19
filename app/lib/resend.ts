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
  private defaultFrom: string = process.env.RESEND_FROM || 'Gurbetbiz <noreply@grbt8.store>'

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
      <title>Hoşgeldiniz - Gurbetbiz</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 40px 20px; text-align: center; }
        .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
        .logo .gurbet { color: white; }
        .logo .biz { color: #1f2937; }
        .content { background: #f8fafc; padding: 40px 30px; color: #374151; }
        .greeting { font-size: 18px; color: #374151; margin-bottom: 20px; }
        .main-text { font-size: 16px; line-height: 1.8; margin-bottom: 25px; }
        .features-title { font-size: 18px; font-weight: 600; color: #374151; margin: 30px 0 20px 0; display: flex; align-items: center; }
        .features-title::before { content: '✈️'; margin-right: 10px; font-size: 20px; }
        .features-list { list-style: none; padding: 0; margin: 0; }
        .features-list li { padding: 8px 0; padding-left: 20px; position: relative; color: #4b5563; }
        .features-list li::before { content: '•'; color: #22c55e; font-weight: bold; position: absolute; left: 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #4ade80, #22c55e); color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 30px 0; font-weight: 600; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3); }
        .button:hover { transform: translateY(-2px); }
        .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 12px; background: #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <span class="gurbet">gurbet</span><span class="biz">biz</span>
          </div>
        </div>
        <div class="content">
          <div class="greeting">Merhaba <strong>${userName}</strong>,</div>
          
          <div class="main-text">
            Gurbetbiz ailesine hoşgeldiniz! Hesabınız başarıyla oluşturuldu ve artık tüm hizmetlerimizden faydalanabilirsiniz.
          </div>
          
          <div class="features-title">Neler Yapabilirsiniz:</div>
          <ul class="features-list">
            <li>En uygun uçak biletlerini arayın</li>
            <li>Rezervasyonlarınızı yönetin</li>
            <li>Özel indirimlerden haberdar olun</li>
            <li>Seyahat geçmişinizi takip edin</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://anasite.grbt8.store/giris" class="button">Hesabıma git</a>
          </div>
        </div>
        
        <!-- Mobil Uygulama Tanıtımı -->
        <div style="text-align: center; padding: 20px;">
          <img src="https://www.grbt8.store/images/Mobil app email.png" alt="Gurbetbiz Mobil Uygulama" style="max-width: 100%; height: auto; border-radius: 10px;" />
        </div>
        
        <div class="footer">
          <p>© 2024 Gurbetbiz. Tüm hakları saklıdır.</p>
          <p>Bu email otomatik olarak gönderilmiştir.</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: userEmail,
      subject: `🎉 Hoşgeldiniz ${userName} - Gurbetbiz Hesabınız Aktif!`,
      html,
      from: 'Gurbetbiz <noreply@grbt8.store>'
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
          <p>© 2024 Gurbetbiz. Tüm hakları saklıdır.</p>
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
          <p>© 2024 Gurbetbiz. Tüm hakları saklıdır.</p>
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
