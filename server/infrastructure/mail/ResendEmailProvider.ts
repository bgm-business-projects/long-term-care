import { Resend } from 'resend'
import type { IEmailService, EmailMessage } from '../../domain/mail/IEmailService'

export class ResendEmailProvider implements IEmailService {
  private resend: Resend
  private fromEmail: string

  constructor(apiKey: string, fromEmail: string) {
    this.resend = new Resend(apiKey)
    this.fromEmail = fromEmail
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    if (process.dev) {
      console.log('[DEV] Sending email to:', message.to)
      console.log('[DEV] Subject:', message.subject)
    }

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: message.to,
      subject: message.subject,
      html: message.html
    })

    if (error) {
      console.error('[ResendEmailProvider] Failed to send email:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }
  }
}
