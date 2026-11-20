export interface AuthUser {
  membershipNumber: string
  email: string
  role: string
}

export interface AccessTokenPayload {
  iss: string
  sub: string
  email: string
  role: string
  type: 'access'
  exp: number
  iat: number
}
