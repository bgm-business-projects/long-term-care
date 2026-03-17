export interface ResetPasswordPayload {
  userName: string
  userEmail: string
  resetUrl: string
}

export interface VerifyEmailPayload {
  userName: string
  userEmail: string
  verifyUrl: string
}
