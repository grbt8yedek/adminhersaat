import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { gunzip } from 'zlib'
import { promisify } from 'util'

const gunzipAsync = promisify(gunzip)

const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN || ''
const BACKUP_REPO = 'grbt8yedek/apauto'
const GITHUB_API = 'https://api.github.com'

async function fetchLatestDatabaseBackupPath(): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${BACKUP_REPO}/contents/database`
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  if (!res.ok) return null
  const list = (await res.json()) as any[]
  const files = list
    .filter((i) => i.type === 'file' && /db_backup_.*\.json\.gz$/i.test(i.name))
    .sort((a, b) => (a.name > b.name ? -1 : 1))
  return files[0]?.path || null
}

async function fetchGithubFileBase64(path: string): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/repos/${BACKUP_REPO}/contents/${encodeURIComponent(path)}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.content as string
}

export async function POST(_request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ success: false, error: 'GITHUB_BACKUP_TOKEN tanımlı değil' }, { status: 500 })
    }

    // 1) Son DB backup dosya yolunu bul
    const latestPath = await fetchLatestDatabaseBackupPath()
    if (!latestPath) {
      return NextResponse.json({ success: false, error: 'GitHub: database yedeği bulunamadı' }, { status: 404 })
    }

    // 2) Dosya içeriğini al (base64 + gzip)
    const base64Content = await fetchGithubFileBase64(latestPath)
    if (!base64Content) {
      return NextResponse.json({ success: false, error: 'GitHub dosya içeriği alınamadı' }, { status: 500 })
    }

    const gzBuffer = Buffer.from(base64Content.replace(/\n/g, ''), 'base64')
    const jsonBuffer = await gunzipAsync(gzBuffer)
    const backup = JSON.parse(jsonBuffer.toString('utf-8'))

    // 3) Beklenen format: createDatabaseBackup() çıktısı
    // tables.users, tables.campaigns
    const users = Array.isArray(backup?.tables?.users) ? backup.tables.users : []
    const campaigns = Array.isArray(backup?.tables?.campaigns) ? backup.tables.campaigns : []

    let restoredUsers = 0
    let restoredCampaigns = 0

    // 4) Upsert kullanıcılar
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          email: u.email,
          phone: u.phone || null,
          countryCode: u.countryCode || null,
          birthDay: u.birthDay || null,
          birthMonth: u.birthMonth || null,
          birthYear: u.birthYear || null,
          gender: u.gender || null,
          identityNumber: u.identityNumber || null,
          isForeigner: Boolean(u.isForeigner),
          role: u.role || 'user',
          status: u.status || 'active',
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
        },
        create: {
          id: u.id,
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          email: u.email,
          phone: u.phone || null,
          countryCode: u.countryCode || null,
          birthDay: u.birthDay || null,
          birthMonth: u.birthMonth || null,
          birthYear: u.birthYear || null,
          gender: u.gender || null,
          identityNumber: u.identityNumber || null,
          isForeigner: Boolean(u.isForeigner),
          role: u.role || 'user',
          status: u.status || 'active',
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
        }
      })
      restoredUsers++
    }

    // 5) Upsert kampanyalar
    for (const c of campaigns) {
      await prisma.campaign.upsert({
        where: { id: c.id },
        update: {
          title: c.title,
          description: c.description || null,
          imageUrl: c.imageUrl || null,
          imageData: c.imageData || null,
          altText: c.altText || '',
          linkUrl: c.linkUrl || null,
          status: c.status || 'active',
          position: c.position || 0,
          clickCount: c.clickCount || 0,
          viewCount: c.viewCount || 0,
          startDate: c.startDate ? new Date(c.startDate) : null,
          endDate: c.endDate ? new Date(c.endDate) : null,
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          createdBy: c.createdBy || null
        },
        create: {
          id: c.id,
          title: c.title,
          description: c.description || null,
          imageUrl: c.imageUrl || null,
          imageData: c.imageData || null,
          altText: c.altText || '',
          linkUrl: c.linkUrl || null,
          status: c.status || 'active',
          position: c.position || 0,
          clickCount: c.clickCount || 0,
          viewCount: c.viewCount || 0,
          startDate: c.startDate ? new Date(c.startDate) : null,
          endDate: c.endDate ? new Date(c.endDate) : null,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          createdBy: c.createdBy || null
        }
      })
      restoredCampaigns++
    }

    return NextResponse.json({
      success: true,
      message: 'GitHub yedeğinden kullanıcılar ve kampanyalar geri yüklendi',
      stats: {
        users: restoredUsers,
        campaigns: restoredCampaigns,
        backupPath: latestPath
      }
    })
  } catch (error) {
    console.error('Restore hatası:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}


