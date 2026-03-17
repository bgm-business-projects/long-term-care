export interface IUserOnboardingRepository {
  acceptConsent(userId: string, timestamp: Date): Promise<void>
  completeOnboarding(userId: string, timestamp: Date): Promise<void>
  markConvertedFromGuest(userId: string, timestamp: Date): Promise<void>
}
