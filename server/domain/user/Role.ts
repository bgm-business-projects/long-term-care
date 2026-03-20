export const VALID_ROLES = ['developer', 'admin', 'agency_staff', 'driver', 'user'] as const
export type Role = typeof VALID_ROLES[number]
