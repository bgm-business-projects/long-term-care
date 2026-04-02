import type { IEmailService, EmailMessage } from '../../domain/mail/IEmailService'

export class ConsoleEmailProvider implements IEmailService {
  async sendEmail(message: EmailMessage): Promise<void> {
    console.log('[ConsoleEmailProvider] Email not sent (no provider configured):')
    console.log(`  To: ${message.to}`)
    console.log(`  Subject: ${message.subject}`)
  }
}
