import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { CvDocumentData } from '../components/CvDocument'
import {
  displayNameOf,
  formatBirthDate,
  formatDateRange,
  formatLocation,
  latestRoleOf,
  sexLabel,
  splitCsv,
} from './profile-utils'
import { careerAssetUrl, publicCvUrl } from './cv-url'

export type CvPdfStyle = 'standard' | 'modern'

export { publicCvUrl }

let fontsRegistered = false

function ensureFonts() {
  if (fontsRegistered) return
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  Font.register({
    family: 'Tajawal',
    fonts: [
      { src: `${base}/fonts/Tajawal-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/fonts/Tajawal-Bold.ttf`, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  fontsRegistered = true
}

function languagesOf(data: CvDocumentData) {
  if (data.languages?.length) return data.languages
  return splitCsv(data.vmsProfile?.languages).map((language) => ({
    language,
    proficiency: null as number | null,
    openToTranslate: false,
  }))
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\u0600-\u06FF\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'CV'
  )
}

async function resolvePhotoDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return url
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

const standard = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontFamily: 'Tajawal',
    fontSize: 10,
    color: '#111827',
    direction: 'rtl',
  },
  brandBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  brandLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
  },
  brandLogo: { width: 28, height: 28 },
  brandTextWrap: { flexShrink: 1 },
  brandTitle: { fontSize: 10, fontWeight: 700, color: '#0f766e', textAlign: 'right' },
  brandSubtitle: { marginTop: 1, fontSize: 7.5, color: '#64748b', textAlign: 'right' },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
    paddingBottom: 12,
    marginBottom: 14,
  },
  docLabel: {
    marginBottom: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
  },
  qrBlock: {
    width: 76,
    alignItems: 'center',
    flexShrink: 0,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  qrImage: { width: 62, height: 62 },
  qrCaption: { marginTop: 3, fontSize: 6.5, color: '#64748b', textAlign: 'center' },
  name: { fontSize: 20, fontWeight: 700, textAlign: 'right', color: '#0f172a' },
  role: { marginTop: 4, fontSize: 11, fontWeight: 700, color: '#0f766e', textAlign: 'right' },
  contact: { marginTop: 6, fontSize: 9, color: '#475569', textAlign: 'right' },
  linkHint: { marginTop: 4, fontSize: 7.5, color: '#94a3b8', textAlign: 'right' },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
    borderBottomWidth: 0.8,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 8,
  },
  body: { fontSize: 10, lineHeight: 1.55, textAlign: 'right', color: '#334155' },
  item: { marginBottom: 9 },
  itemHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'right',
    flexGrow: 1,
  },
  itemMeta: { fontSize: 9, color: '#0f766e', textAlign: 'right' },
  itemDates: { fontSize: 8.5, color: '#64748b', textAlign: 'left', minWidth: 90 },
  chips: { marginTop: 4, fontSize: 8.5, color: '#475569', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 42,
    right: 42,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

const modern = StyleSheet.create({
  page: {
    fontFamily: 'Tajawal',
    fontSize: 9.5,
    color: '#0f172a',
    direction: 'rtl',
    flexDirection: 'row-reverse',
  },
  sidebar: {
    width: '32%',
    backgroundColor: '#0f766e',
    color: '#ecfeff',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  main: {
    width: '68%',
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 22,
    backgroundColor: '#ffffff',
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    objectFit: 'cover',
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#99f6e4',
  },
  photoFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: '#115e59',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#99f6e4',
  },
  photoInitials: { fontSize: 22, fontWeight: 700, color: '#ecfeff' },
  sideName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  sideRole: {
    fontSize: 9,
    color: '#ccfbf1',
    textAlign: 'center',
    marginBottom: 14,
  },
  sideSection: { marginBottom: 14 },
  sideTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204,251,241,0.35)',
    paddingBottom: 3,
  },
  sideText: { fontSize: 8, color: '#ecfeff', textAlign: 'right', lineHeight: 1.45, marginBottom: 3 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: '#ecfeff',
    fontSize: 7.5,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  qrWrap: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 6,
  },
  qrImage: { width: 70, height: 70 },
  qrCaption: { marginTop: 3, fontSize: 6.5, color: '#0f766e', textAlign: 'center' },
  brandRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  brandLogo: { width: 22, height: 22 },
  brandTitle: { fontSize: 9, fontWeight: 700, color: '#0f766e', textAlign: 'right' },
  heroBand: {
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  heroName: { fontSize: 18, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  heroRole: { marginTop: 3, fontSize: 11, fontWeight: 700, color: '#0f766e', textAlign: 'right' },
  heroContact: { marginTop: 6, fontSize: 8.5, color: '#475569', textAlign: 'right' },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
  },
  body: { fontSize: 9, lineHeight: 1.5, textAlign: 'right', color: '#334155' },
  item: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderRightWidth: 3,
    borderRightColor: '#0f766e',
  },
  itemTitle: { fontSize: 10, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  itemMeta: { fontSize: 8, color: '#0f766e', textAlign: 'right', marginTop: 2 },
  itemDates: { fontSize: 7.5, color: '#64748b', textAlign: 'right', marginTop: 2 },
  chips: { marginTop: 4, fontSize: 7.5, color: '#475569', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 22,
    right: 22,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

type PdfShared = {
  data: CvDocumentData
  cvUrl: string
  qrDataUrl: string
  logoUrl: string
  photoUrl?: string | null
}

function StandardCvPdfDocument({ data, cvUrl, qrDataUrl, logoUrl }: PdfShared) {
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages = languagesOf(data)
  const location = formatLocation({
    country: vms?.country,
    region: vms?.region,
    city: vms?.city,
  })
  const birthDate = formatBirthDate(vms?.dateOfBirth)
  const sex = sexLabel(vms?.sex)
  const contact = [
    vms?.email,
    vms?.phoneNumber,
    location,
    sex !== '—' ? sex : null,
    birthDate ? `DOB ${birthDate}` : null,
  ]
    .filter(Boolean)
    .join('  |  ')
  const educationLine = [vms?.fieldOfStudy, vms?.educationLevel, vms?.school]
    .filter(Boolean)
    .join(' · ')

  return (
    <Document title={`CV — ${name}`} author={name} subject="Curriculum Vitae" language="ar">
      <Page size="A4" style={standard.page}>
        <View style={standard.brandBar}>
          <View style={standard.brandLeft}>
            <Image style={standard.brandLogo} src={logoUrl} />
            <View style={standard.brandTextWrap}>
              <Text style={standard.brandTitle}>المسار المهني</Text>
              <Text style={standard.brandSubtitle}>Career Path · Standard CV</Text>
            </View>
          </View>
          <View style={standard.qrBlock}>
            <Image style={standard.qrImage} src={qrDataUrl} />
            <Text style={standard.qrCaption}>Online CV</Text>
          </View>
        </View>

        <View style={standard.header}>
          <Text style={standard.docLabel}>Curriculum Vitae / سيرة ذاتية</Text>
          <Text style={standard.name}>{name}</Text>
          {role ? <Text style={standard.role}>{role}</Text> : null}
          {contact ? <Text style={standard.contact}>{contact}</Text> : null}
          <Text style={standard.linkHint}>Scan QR for online CV · امسح الرمز لعرض السيرة</Text>
        </View>

        {data.profile.summary ? (
          <View style={standard.section}>
            <Text style={standard.sectionTitle}>Professional Summary / النبذة المهنية</Text>
            <Text style={standard.body}>{data.profile.summary}</Text>
          </View>
        ) : null}

        {!!data.workExperiences?.length && (
          <View style={standard.section}>
            <Text style={standard.sectionTitle}>Work Experience / الخبرة العملية</Text>
            {data.workExperiences.map((item) => (
              <View key={item.id} style={standard.item} wrap={false}>
                <View style={standard.itemHeader}>
                  <Text style={standard.itemTitle}>
                    {item.title}
                    {item.company_name ? ` — ${item.company_name}` : ''}
                  </Text>
                  <Text style={standard.itemDates}>
                    {formatDateRange(item.start_date, item.end_date, item.is_current, 'Present')}
                  </Text>
                </View>
                {item.location ? <Text style={standard.itemMeta}>{item.location}</Text> : null}
                {(item.responsibilities || item.description) && (
                  <Text style={standard.body}>{item.responsibilities || item.description}</Text>
                )}
                {item.achievements ? <Text style={standard.body}>{item.achievements}</Text> : null}
                {!!item.skills?.length && (
                  <Text style={standard.chips}>
                    Skills: {item.skills.map((s) => s.name).join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {educationLine ? (
          <View style={standard.section} wrap={false}>
            <Text style={standard.sectionTitle}>Education / التعليم</Text>
            <Text style={standard.itemTitle}>{vms?.fieldOfStudy || vms?.educationLevel}</Text>
            <Text style={standard.itemMeta}>
              {[vms?.school, vms?.educationLevel, vms?.graduationYear ? `Class of ${vms.graduationYear}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {!!data.projects?.length && (
          <View style={standard.section}>
            <Text style={standard.sectionTitle}>Projects / المشاريع</Text>
            {data.projects.map((item) => (
              <View key={item.id} style={standard.item} wrap={false}>
                <View style={standard.itemHeader}>
                  <Text style={standard.itemTitle}>{item.name}</Text>
                  {(item.start_date || item.end_date || item.is_ongoing) && (
                    <Text style={standard.itemDates}>
                      {formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'Ongoing')}
                    </Text>
                  )}
                </View>
                {[item.role, item.company].filter(Boolean).length ? (
                  <Text style={standard.itemMeta}>
                    {[item.role, item.company].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {item.responsibilities ? (
                  <Text style={standard.body}>{item.responsibilities}</Text>
                ) : null}
                {item.outcomes ? <Text style={standard.body}>{item.outcomes}</Text> : null}
                {!!item.skills?.length && (
                  <Text style={standard.chips}>
                    Skills: {item.skills.map((s) => s.name).join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {!!skills.length && (
          <View style={standard.section} wrap={false}>
            <Text style={standard.sectionTitle}>Skills / المهارات</Text>
            <Text style={standard.body}>{skills.join(' · ')}</Text>
          </View>
        )}

        {!!languages.length && (
          <View style={standard.section} wrap={false}>
            <Text style={standard.sectionTitle}>Languages / اللغات</Text>
            {languages.map((lang) => {
              const level = lang.proficiency != null ? ` (${lang.proficiency}/10)` : ''
              const translate = lang.openToTranslate ? ' — open to translation' : ''
              return (
                <Text key={lang.language} style={standard.body}>
                  {`${lang.language}${level}${translate}`}
                </Text>
              )
            })}
          </View>
        )}

        {!!interests.length && (
          <View style={standard.section} wrap={false}>
            <Text style={standard.sectionTitle}>Interests / الاهتمامات</Text>
            <Text style={standard.body}>{interests.join(' · ')}</Text>
          </View>
        )}

        <Text
          style={standard.footer}
          render={({ pageNumber, totalPages }) =>
            `Curriculum Vitae · المسار المهني  |  ${cvUrl}  |  ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

function ModernCvPdfDocument({ data, cvUrl, qrDataUrl, logoUrl, photoUrl }: PdfShared) {
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages = languagesOf(data)
  const location = formatLocation({
    country: vms?.country,
    region: vms?.region,
    city: vms?.city,
  })
  const birthDate = formatBirthDate(vms?.dateOfBirth)
  const sex = sexLabel(vms?.sex)
  const contact = [vms?.email, vms?.phoneNumber, location].filter(Boolean).join('  ·  ')
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return (
    <Document title={`CV — ${name}`} author={name} subject="Modern Curriculum Vitae" language="ar">
      <Page size="A4" style={modern.page}>
        <View style={modern.sidebar}>
          {photoUrl ? (
            <Image style={modern.photo} src={photoUrl} />
          ) : (
            <View style={modern.photoFallback}>
              <Text style={modern.photoInitials}>{initials || '؟'}</Text>
            </View>
          )}
          <Text style={modern.sideName}>{name}</Text>
          {role ? <Text style={modern.sideRole}>{role}</Text> : null}

          <View style={modern.sideSection}>
            <Text style={modern.sideTitle}>تواصل</Text>
            {vms?.email ? <Text style={modern.sideText}>{vms.email}</Text> : null}
            {vms?.phoneNumber ? <Text style={modern.sideText}>{vms.phoneNumber}</Text> : null}
            {location ? <Text style={modern.sideText}>{location}</Text> : null}
            {sex !== '—' ? <Text style={modern.sideText}>{sex}</Text> : null}
            {birthDate ? <Text style={modern.sideText}>{`تاريخ الميلاد: ${birthDate}`}</Text> : null}
          </View>

          {!!skills.length && (
            <View style={modern.sideSection}>
              <Text style={modern.sideTitle}>المهارات</Text>
              {skills.slice(0, 14).map((skill) => (
                <Text key={skill} style={modern.chip}>
                  {skill}
                </Text>
              ))}
            </View>
          )}

          {!!languages.length && (
            <View style={modern.sideSection}>
              <Text style={modern.sideTitle}>اللغات</Text>
              {languages.map((lang) => {
                const level = lang.proficiency != null ? ` · ${lang.proficiency}/10` : ''
                const translate = lang.openToTranslate ? ' · ترجمة' : ''
                return (
                  <Text key={lang.language} style={modern.sideText}>
                    {`${lang.language}${level}${translate}`}
                  </Text>
                )
              })}
            </View>
          )}

          {!!interests.length && (
            <View style={modern.sideSection}>
              <Text style={modern.sideTitle}>الاهتمامات</Text>
              <Text style={modern.sideText}>{interests.join(' · ')}</Text>
            </View>
          )}

          <View style={modern.qrWrap}>
            <Image style={modern.qrImage} src={qrDataUrl} />
            <Text style={modern.qrCaption}>السيرة أونلاين</Text>
          </View>
        </View>

        <View style={modern.main}>
          <View style={modern.brandRow}>
            <Image style={modern.brandLogo} src={logoUrl} />
            <Text style={modern.brandTitle}>المسار المهني · Modern CV</Text>
          </View>

          <View style={modern.heroBand}>
            <Text style={modern.heroName}>{name}</Text>
            {role ? <Text style={modern.heroRole}>{role}</Text> : null}
            {contact ? <Text style={modern.heroContact}>{contact}</Text> : null}
          </View>

          {data.profile.summary ? (
            <View style={modern.section}>
              <Text style={modern.sectionTitle}>النبذة المهنية</Text>
              <Text style={modern.body}>{data.profile.summary}</Text>
            </View>
          ) : null}

          {!!data.workExperiences?.length && (
            <View style={modern.section}>
              <Text style={modern.sectionTitle}>الخبرة العملية</Text>
              {data.workExperiences.map((item) => (
                <View key={item.id} style={modern.item} wrap={false}>
                  <Text style={modern.itemTitle}>
                    {item.title}
                    {item.company_name ? ` — ${item.company_name}` : ''}
                  </Text>
                  <Text style={modern.itemDates}>
                    {formatDateRange(item.start_date, item.end_date, item.is_current, 'حالياً')}
                    {item.location ? ` · ${item.location}` : ''}
                  </Text>
                  {(item.responsibilities || item.description) && (
                    <Text style={modern.body}>{item.responsibilities || item.description}</Text>
                  )}
                  {item.achievements ? <Text style={modern.body}>{item.achievements}</Text> : null}
                  {!!item.skills?.length && (
                    <Text style={modern.chips}>
                      {item.skills.map((s) => s.name).join(' · ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {(vms?.fieldOfStudy || vms?.school || vms?.educationLevel) && (
            <View style={modern.section} wrap={false}>
              <Text style={modern.sectionTitle}>التعليم</Text>
              <View style={modern.item}>
                <Text style={modern.itemTitle}>
                  {vms?.fieldOfStudy || vms?.educationLevel || 'خلفية أكاديمية'}
                </Text>
                <Text style={modern.itemMeta}>
                  {[vms?.school, vms?.educationLevel, vms?.graduationYear]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          )}

          {!!data.projects?.length && (
            <View style={modern.section}>
              <Text style={modern.sectionTitle}>المشاريع</Text>
              {data.projects.map((item) => (
                <View key={item.id} style={modern.item} wrap={false}>
                  <Text style={modern.itemTitle}>{item.name}</Text>
                  <Text style={modern.itemMeta}>
                    {[item.role, item.company].filter(Boolean).join(' · ')}
                  </Text>
                  {(item.start_date || item.end_date || item.is_ongoing) && (
                    <Text style={modern.itemDates}>
                      {formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'مستمر')}
                    </Text>
                  )}
                  {item.responsibilities ? (
                    <Text style={modern.body}>{item.responsibilities}</Text>
                  ) : null}
                  {item.outcomes ? <Text style={modern.body}>{item.outcomes}</Text> : null}
                  {!!item.skills?.length && (
                    <Text style={modern.chips}>
                      {item.skills.map((s) => s.name).join(' · ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <Text
            style={modern.footer}
            render={({ pageNumber, totalPages }) =>
              `المسار المهني  ·  ${cvUrl}  ·  ${pageNumber}/${totalPages}`
            }
            fixed
          />
        </View>
      </Page>
    </Document>
  )
}

export async function downloadCvPdf(data: CvDocumentData, style: CvPdfStyle = 'standard') {
  ensureFonts()
  const membership = data.profile.membership_number
  if (!membership) throw new Error('Missing membership number for CV link')

  const logoUrl = careerAssetUrl('/career-mark.png')
  const cvUrl = publicCvUrl(membership)
  const qrDataUrl = await QRCode.toDataURL(cvUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#0f172a', light: '#ffffff' },
  })
  const photoUrl =
    style === 'modern' ? await resolvePhotoDataUrl(data.vmsProfile?.profilePictureUrl) : null
  const name = displayNameOf(data)
  const suffix = style === 'modern' ? 'modern' : 'standard'
  const doc =
    style === 'modern' ? (
      <ModernCvPdfDocument
        data={data}
        cvUrl={cvUrl}
        qrDataUrl={qrDataUrl}
        logoUrl={logoUrl}
        photoUrl={photoUrl}
      />
    ) : (
      <StandardCvPdfDocument
        data={data}
        cvUrl={cvUrl}
        qrDataUrl={qrDataUrl}
        logoUrl={logoUrl}
      />
    )

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `CV-${safeFileName(name)}-${suffix}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
