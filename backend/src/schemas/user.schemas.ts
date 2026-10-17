export interface CreateUserInfoParams {
  membershipNumber: string
  enName: string
  arName: string
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
  languages: string | null
}

export interface CreateUserRegistrationInfoParams {
  membershipNumber: string
  whereHeardAboutUs: string | null
  motivationLetter: string | null
  friendsOnPlatform: string | null
  interestInVolunteering: string | null
  previousExperience: string | null
}

export interface CreateUserParams {
  membershipNumber: string
  email: string
  passwordHash: string
  role: string
  emailVerified: boolean
}