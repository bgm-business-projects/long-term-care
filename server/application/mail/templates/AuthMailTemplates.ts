import type { EmailMessage } from '../../../domain/mail/IEmailService'
import type { ResetPasswordPayload, VerifyEmailPayload } from '../dtos/EmailPayload'

export class AuthMailTemplates {
  static buildResetPasswordEmail(payload: ResetPasswordPayload): EmailMessage {
    return {
      to: payload.userEmail,
      subject: 'Reset your MyApp password',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-family: 'Montserrat', sans-serif; font-size: 24px; margin: 0;">MyApp</h1>
  </div>
  <h2 style="font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
  <p>Hi ${payload.userName},</p>
  <p>We received a request to reset your password. Click the button below to set a new password:</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${payload.resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
  </div>
  <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">MyApp</p>
</body>
</html>`.trim()
    }
  }

  static buildVerifyEmail(payload: VerifyEmailPayload): EmailMessage {
    return {
      to: payload.userEmail,
      subject: 'Verify your MyApp email',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-family: 'Montserrat', sans-serif; font-size: 24px; margin: 0;">MyApp</h1>
  </div>
  <h2 style="font-size: 20px; margin-bottom: 16px;">Verify your email</h2>
  <p>Hi ${payload.userName},</p>
  <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${payload.verifyUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email</a>
  </div>
  <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">MyApp</p>
</body>
</html>`.trim()
    }
  }
}
