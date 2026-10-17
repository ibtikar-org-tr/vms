export interface MemberProfile {
  membershipNumber: string
  email: string
  emailVerified: boolean
  role: string
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  dateOfBirth: string | null
  country: string | null
  region: string | null
  city: string | null
  address: string | null
  educationLevel: string | null
  school: string | null
  fieldOfStudy: string | null
  graduationYear: number | null
  bloodType: string | null
  telegramId: string | null
  telegramUsername: string | null
  socialMediaLinks: string | null
  profilePictureUrl: string | null
  biography: string | null
  interests: string | null
  skills: string | null
  languages: string | null
}

export type ProfileUpdatePayload = Partial<{
  enName: string
  arName: string
  phoneNumber: string
  sex: string
  dateOfBirth: string
  country: string
  region: string
  city: string
  address: string
  educationLevel: string
  school: string
  graduationYear: number
  fieldOfStudy: string
  bloodType: string
  socialMediaLinks: string
  biography: string
  interests: string
  skills: string
  languages: string
}>
