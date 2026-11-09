import type { IngestDocument } from '../vectorize'

/**
 * Stable public organization/membership facts used as website-side seed content.
 * Website crawl supplements this; seed ensures membership/org Q&A works even if crawl fails.
 */
export function buildOrgSeedDocuments(env: CloudflareBindings): IngestDocument[] {
  const website = env.WEBSITE_BASE_URL || 'https://ibtikar.org.tr'
  const members = env.MEMBERS_SITE_URL || 'https://ibtikar.tr'

  return [
    {
      docId: 'website:org-overview',
      source: 'website',
      kind: 'organization',
      title: 'About Ibtikar Assembly',
      url: website,
      text: `Ibtikar Volunteer Assembly (تجمّع إبتكار التطوّعي / İbtikar Gönüllü Topluluğu).
Official website: ${website}
Members platform: ${members}
Founded: October 5, 2022
Location: Turkey (primarily Istanbul) and Syria
Audience: Arabic-speaking university students interested in innovation, technology, research, and development
Bylaws: https://github.com/ibtikar-org-tr/bylaws

Vision: A leader community in building conscious youth, innovative solutions, and with social impact.
Mission: Investing and coordinating efforts among students to develop their technical skills, stimulate their innovation and creativity, and enhance their effectiveness in serving and advancing society.

Core values: Quality (الجودة), Creativity (الإبداع), Collaboration (التّشارك), Independence (الاستقلالية), Favour/Excellence (الإحسان).

Main goals:
1. Activate meaningful communication in the youth technical community
2. Develop technical skills and stimulate innovation
3. Strengthen students' community role
4. Increase opportunities for Arab students to create projects and join technical competitions
5. Help successful projects by Arab students emerge

Contact:
- Email: relations@ibtikar.org.tr
- WhatsApp: +905078222022
- Instagram: @ibtikar.org.tr
- LinkedIn: company/ibtikar-org-tr
- GitHub: ibtikar-org-tr
- Telegram channel: @ibtikar_org
- Telegram bot: https://t.me/ibtikar_bot`,
    },
    {
      docId: 'website:membership',
      source: 'website',
      kind: 'membership',
      title: 'Ibtikar membership',
      url: `${members}/signup`,
      text: `Ibtikar membership is completely free.

How to become a member:
- Start at ${members}/signup
- Request a signup link by email, or use the Telegram bot /signup command (https://t.me/ibtikar_bot)
- Email signups must finish Telegram /verify before login
- Telegram signups can log in before email confirmation is complete

Eligibility:
- University student in Turkey or Syria; OR graduate under 30; OR graduated within the last 2 years

Membership benefits:
- Priority access to events and services
- Right to volunteer for open positions
- Access to technical clubs and specialized learning
- Networking with the Ibtikar community
- Participation in TEKNOFEST and other technical competitions
- Access to Freezcamps and interactive courses
- Volunteer certificates for completed work

Members platform (VMS): ${members}
- Browse projects, clubs, events, and volunteering opportunities after login
- Recover membership info at ${members}/iforgot

Official bot: https://t.me/ibtikar_bot
Official channel: https://t.me/ibtikar_org`,
    },
    {
      docId: 'website:programs-overview',
      source: 'website',
      kind: 'programs',
      title: 'Known Ibtikar initiatives',
      url: website,
      text: `Known Ibtikar initiatives (often managed as projects on the members platform):
1. TEKNOFEST Arabic Platform — forms teams for Teknofest Festival projects (@teknofest_ar)
2. Ibtikar Mines — guides Arab students to useful technical programs (@ibtikar.mines)
3. Freezcamps — interactive course experiences (lms.ibtikar.org.tr)
4. Student Clubs — field-focused gatherings (AI, Web Dev, Cybersecurity, Robotics, etc.)
5. Student Activities — educational trips, cultural events, sports, volunteering
6. Student Forums — conferences and programs for networking and learning

Technical club areas include AI Development, Open Source AI, Web and Mobile Development, Networking and Cloud Computing, Cyber Security, Robotics, Medical Technology, and Entrepreneurship.

Live event, program, and open volunteering details are also ingested from the project database into this chatbot.`,
    },
  ]
}
