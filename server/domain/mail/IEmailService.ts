export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export interface IEmailService {
  sendEmail(message: EmailMessage): Promise<void>
}
