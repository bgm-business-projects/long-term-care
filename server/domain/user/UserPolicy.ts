import { VALID_ROLES, type Role } from './Role'

export class UserPolicy {
  static isAdminOrAbove(role: string): boolean {
    return role === 'developer' || role === 'admin'
  }

  static isAgencyStaffOrAbove(role: string): boolean {
    return role === 'developer' || role === 'admin' || role === 'agency_staff'
  }

  static isDeveloper(role: string): boolean {
    return role === 'developer'
  }

  static canChangeRole(targetUserId: string, adminUserId: string, actorRole: string): boolean {
    if (targetUserId === adminUserId) return false
    if (!this.isDeveloper(actorRole)) return false
    return true
  }

  static canBan(targetUserId: string, adminUserId: string): boolean {
    return targetUserId !== adminUserId
  }

  static canDelete(targetUserId: string, adminUserId: string): boolean {
    return targetUserId !== adminUserId
  }

  static isValidRole(role: string): role is Role {
    return (VALID_ROLES as readonly string[]).includes(role)
  }
}
