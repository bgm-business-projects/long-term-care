import { eq } from 'drizzle-orm'
import { useDb } from '../db/drizzle'
import { session } from '../db/schema'
import type { IIdentityServiceProvider } from '../../domain/user/IIdentityServiceProvider'
import { AuthMailTemplates } from '../../application/mail/templates/AuthMailTemplates'
import type { IEmailService } from '../../domain/mail/IEmailService'

export class BetterAuthIdentityService implements IIdentityServiceProvider {
  constructor(
    private emailService: IEmailService,
    private baseUrl: string
  ) {}

  async sendPasswordResetEmail(userId: string, email: string): Promise<void> {
    // Generate a simple reset token and build the URL
    // Better Auth's forgetPassword flow uses the verification table internally,
    // but for admin-initiated resets we can use the same email template
    // with a direct link to the forgot-password page
    const message = AuthMailTemplates.buildResetPasswordEmail({
      userName: email.split('@')[0] ?? email,
      userEmail: email,
      resetUrl: `${this.baseUrl}/forgot-password`
    })
    await this.emailService.sendEmail(message)
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const db = useDb()
    await db.delete(session).where(eq(session.userId, userId))
  }
}
