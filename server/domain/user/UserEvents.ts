export type UserBannedEvent = { type: 'USER_BANNED'; userId: string; adminId: string }
export type UserRoleChangedEvent = { type: 'USER_ROLE_CHANGED'; userId: string; oldRole: string; newRole: string }
export type UserDeletedEvent = { type: 'USER_DELETED'; userId: string; adminId: string }
export type GuestConvertedEvent = { type: 'GUEST_CONVERTED'; userId: string; convertedAt: Date }
