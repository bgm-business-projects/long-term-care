import { ResendEmailProvider } from '../infrastructure/mail/ResendEmailProvider'
import type { IEmailService } from '../domain/mail/IEmailService'

export function useEmailService(): IEmailService {
  const config = useRuntimeConfig()
  return new ResendEmailProvider(config.resend.apiKey, config.resend.fromEmail)
}
