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
  formatDateRange,
  latestRoleOf,
  splitCsv,
} from './profile-utils'

export function publicCvUrl(membershipNumber: string) {
  const origin =
    (typeof window !== 'undefined' && window.location.origin) ||
    (import.meta.env.VITE_CAREER_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ||
    ''
  return `${origin}/talent/${encodeURIComponent(membershipNumber)}`
}

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
  // Avoid broken default hyphenation on Arabic text
  Font.registerHyphenationCallback((word) => [word])
  fontsRegistered = true
}

const styles = StyleSheet.create({
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
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandTextWrap: {
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
  },
  brandSubtitle: {
    marginTop: 1,
    fontSize: 7.5,
    color: '#64748b',
    textAlign: 'right',
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
    paddingBottom: 12,
    marginBottom: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerMain: {
    flexGrow: 1,
    flexShrink: 1,
  },
  docLabel: {
    marginBottom: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
    letterSpacing: 0.4,
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
  qrImage: {
    width: 62,
    height: 62,
  },
  qrCaption: {
    marginTop: 3,
    fontSize: 6.5,
    color: '#64748b',
    textAlign: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'right',
    color: '#0f172a',
  },
  role: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
  },
  contact: {
    marginTop: 6,
    fontSize: 9,
    color: '#475569',
    textAlign: 'right',
  },
  linkHint: {
    marginTop: 4,
    fontSize: 7.5,
    color: '#94a3b8',
    textAlign: 'right',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f766e',
    textAlign: 'right',
    borderBottomWidth: 0.8,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'none',
  },
  body: {
    fontSize: 10,
    lineHeight: 1.55,
    textAlign: 'right',
    color: '#334155',
  },
  item: {
    marginBottom: 9,
  },
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
  itemMeta: {
    fontSize: 9,
    color: '#0f766e',
    textAlign: 'right',
  },
  itemDates: {
    fontSize: 8.5,
    color: '#64748b',
    textAlign: 'left',
    minWidth: 90,
  },
  chips: {
    marginTop: 4,
    fontSize: 8.5,
    color: '#475569',
    textAlign: 'right',
  },
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

function StandardCvPdfDocument({
  data,
  cvUrl,
  qrDataUrl,
  logoUrl,
}: {
  data: CvDocumentData
  cvUrl: string
  qrDataUrl: string
  logoUrl: string
}) {
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages =
    data.languages?.length
      ? data.languages
      : splitCsv(vms?.languages).map((language) => ({
          language,
          proficiency: null as number | null,
          openToTranslate: false,
        }))
  const location = [vms?.city, vms?.country].filter(Boolean).join(' · ')
  const contact = [vms?.email, vms?.phoneNumber, location].filter(Boolean).join('  |  ')
  const educationLine = [vms?.fieldOfStudy, vms?.educationLevel, vms?.school]
    .filter(Boolean)
    .join(' · ')

  return (
    <Document
      title={`CV — ${name}`}
      author={name}
      subject="Curriculum Vitae"
      creator="Ibtikar Career"
      language="ar"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            <Image style={styles.brandLogo} src={logoUrl} />
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>المسار المهني</Text>
              <Text style={styles.brandSubtitle}>Career Path · Professional CV</Text>
            </View>
          </View>
          <View style={styles.qrBlock}>
            <Image style={styles.qrImage} src={qrDataUrl} />
            <Text style={styles.qrCaption}>Online CV</Text>
          </View>
        </View>

        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.docLabel}>Curriculum Vitae / سيرة ذاتية</Text>
            <Text style={styles.name}>{name}</Text>
            {role ? <Text style={styles.role}>{role}</Text> : null}
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            <Text style={styles.linkHint}>Scan QR for online CV · امسح الرمز لعرض السيرة</Text>
          </View>
        </View>

        {data.profile.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary / النبذة المهنية</Text>
            <Text style={styles.body}>{data.profile.summary}</Text>
          </View>
        ) : null}

        {!!data.workExperiences?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Experience / الخبرة العملية</Text>
            {data.workExperiences.map((item) => (
              <View key={item.id} style={styles.item} wrap={false}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {item.title}
                    {item.company_name ? ` — ${item.company_name}` : ''}
                  </Text>
                  <Text style={styles.itemDates}>
                    {formatDateRange(item.start_date, item.end_date, item.is_current, 'Present')}
                  </Text>
                </View>
                {item.location ? <Text style={styles.itemMeta}>{item.location}</Text> : null}
                {(item.responsibilities || item.description) && (
                  <Text style={styles.body}>{item.responsibilities || item.description}</Text>
                )}
                {item.achievements ? <Text style={styles.body}>{item.achievements}</Text> : null}
                {!!item.skills?.length && (
                  <Text style={styles.chips}>
                    Skills: {item.skills.map((s) => s.name).join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {educationLine ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Education / التعليم</Text>
            <Text style={styles.itemTitle}>{vms?.fieldOfStudy || vms?.educationLevel}</Text>
            <Text style={styles.itemMeta}>
              {[vms?.school, vms?.educationLevel, vms?.graduationYear ? `Class of ${vms.graduationYear}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {!!data.projects?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects / المشاريع</Text>
            {data.projects.map((item) => (
              <View key={item.id} style={styles.item} wrap={false}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  {(item.start_date || item.end_date || item.is_ongoing) && (
                    <Text style={styles.itemDates}>
                      {formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'Ongoing')}
                    </Text>
                  )}
                </View>
                {[item.role, item.company].filter(Boolean).length ? (
                  <Text style={styles.itemMeta}>
                    {[item.role, item.company].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {item.responsibilities ? (
                  <Text style={styles.body}>{item.responsibilities}</Text>
                ) : null}
                {item.outcomes ? <Text style={styles.body}>{item.outcomes}</Text> : null}
                {!!item.skills?.length && (
                  <Text style={styles.chips}>
                    Skills: {item.skills.map((s) => s.name).join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {!!skills.length && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Skills / المهارات</Text>
            <Text style={styles.body}>{skills.join(' · ')}</Text>
          </View>
        )}

        {!!languages.length && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Languages / اللغات</Text>
            {languages.map((lang) => {
              const level = lang.proficiency != null ? ` (${lang.proficiency}/10)` : ''
              const translate = lang.openToTranslate ? ' — open to translation' : ''
              return (
                <Text key={lang.language} style={styles.body}>
                  {`${lang.language}${level}${translate}`}
                </Text>
              )
            })}
          </View>
        )}

        {!!interests.length && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Interests / الاهتمامات</Text>
            <Text style={styles.body}>{interests.join(' · ')}</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Curriculum Vitae · المسار المهني  |  ${cvUrl}  |  ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

function safeFileName(name: string) {
  return name
    .replace(/[^\w\u0600-\u06FF\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'CV'
}

export async function downloadCvPdf(data: CvDocumentData) {
  ensureFonts()
  const membership = data.profile.membership_number
  if (!membership) {
    throw new Error('Missing membership number for CV link')
  }
  const origin =
    (typeof window !== 'undefined' && window.location.origin) ||
    (import.meta.env.VITE_CAREER_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ||
    ''
  const logoUrl = `${origin}/career-mark.png`
  const cvUrl = publicCvUrl(membership)
  const qrDataUrl = await QRCode.toDataURL(cvUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#0f172a', light: '#ffffff' },
  })
  const name = displayNameOf(data)
  const blob = await pdf(
    <StandardCvPdfDocument
      data={data}
      cvUrl={cvUrl}
      qrDataUrl={qrDataUrl}
      logoUrl={logoUrl}
    />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `CV-${safeFileName(name)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
