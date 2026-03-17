export const VALID_ROLES = ['developer', 'admin', 'user'] as const
export type Role = typeof VALID_ROLES[number]
