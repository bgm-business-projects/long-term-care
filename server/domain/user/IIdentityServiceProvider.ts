export interface IIdentityServiceProvider {
  sendPasswordResetEmail(userId: string, email: string): Promise<void>
  revokeAllSessions(userId: string): Promise<void>
}
