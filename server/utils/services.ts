import { ResendEmailProvider } from '../infrastructure/mail/ResendEmailProvider'
import { ConsoleEmailProvider } from '../infrastructure/mail/ConsoleEmailProvider'
import type { IEmailService } from '../domain/mail/IEmailService'

export function useEmailService(): IEmailService {
  const config = useRuntimeConfig()
  const apiKey = config.resend?.apiKey
  if (!apiKey) {
    console.warn('[Email] NUXT_RESEND_API_KEY not set, emails will be logged to console only')
    return new ConsoleEmailProvider()
  }
  return new ResendEmailProvider(apiKey, config.resend.fromEmail)
}
