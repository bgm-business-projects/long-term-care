import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { useDb } from '../db/drizzle'
import { AuthMailTemplates } from '../../application/mail/templates/AuthMailTemplates'

function createAuthInstance() {
  const config = useRuntimeConfig()
  const db = useDb()
  const emailService = useEmailService()

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg'
    }),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60
      }
    },
    secret: config.betterAuth.secret,
    baseURL: config.betterAuth.url,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        const message = AuthMailTemplates.buildResetPasswordEmail({
          userName: user.name,
          userEmail: user.email,
          resetUrl: url
        })
        await emailService.sendEmail(message)
      }
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const message = AuthMailTemplates.buildVerifyEmail({
          userName: user.name,
          userEmail: user.email,
          verifyUrl: url
        })
        await emailService.sendEmail(message)
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true
    },
    socialProviders: {
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret
      }
    },
    trustedOrigins: [
      config.betterAuth.url,
      config.betterAuth.url.replace('https://', 'https://www.')
    ],
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'user',
          input: false
        },
        organizationId: {
          type: 'string',
          required: false,
          input: false
        },
        lastNotifiedTier: {
          type: 'string',
          required: false,
          input: false
        },
        banned: {
          type: 'boolean',
          defaultValue: false,
          input: false
        },
        subscriptionTier: {
          type: 'string',
          defaultValue: 'free',
          input: false
        },
        subscriptionExpiresAt: {
          type: 'date',
          required: false,
          input: false
        },
        consentAcceptedAt: {
          type: 'date',
          required: false,
          input: false
        },
        onboardingCompletedAt: {
          type: 'date',
          required: false,
          input: false
        },
        convertedFromGuestAt: {
          type: 'date',
          required: false,
          input: false
        }
      }
    }
  })
}

let authInstance: ReturnType<typeof createAuthInstance> | undefined

export function useAuth() {
  if (!authInstance) {
    authInstance = createAuthInstance()
  }
  return authInstance
}
