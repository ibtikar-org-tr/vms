import { z } from 'zod'

const requiredTrimmedString = z.string().trim().min(1)
const optionalTrimmedString = z.string().trim().min(1).optional()

const requiredStringArray = z.array(z.string().trim().min(1)).min(1)
const optionalStringArray = z.array(z.string().trim().min(1)).min(1).optional()

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/

export const registrationSchema = z.object({
  signupToken: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),

  enName: z.string().trim().min(2).max(120),
  arName: z.string().trim().min(2).max(120),
  phoneNumber: requiredTrimmedString,
  sex: z.enum(['male', 'female']),
  dateOfBirth: z.string().regex(dateOnlyRegex, 'Use YYYY-MM-DD format').optional(),
  country: z.string().trim().toUpperCase().length(2),
  region: requiredTrimmedString,
  city: optionalTrimmedString,
  address: optionalTrimmedString,
  educationLevel: requiredTrimmedString,
  school: requiredTrimmedString,
  fieldOfStudy: requiredTrimmedString,
  graduationYear: z.number().int().min(1950).max(2100),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  socialMediaLinks: z.record(z.string().trim(), z.string().trim().url()).optional(),
  biography: optionalTrimmedString,
  interests: requiredStringArray,
  skills: optionalStringArray,
  languages: optionalStringArray,

  whereHeardAboutUs: optionalTrimmedString,
  motivationLetter: optionalTrimmedString,
  friendsOnPlatform: optionalStringArray,
  interestInVolunteering: optionalTrimmedString,
  previousExperience: optionalTrimmedString,
})

export type RegistrationInput = z.infer<typeof registrationSchema>
