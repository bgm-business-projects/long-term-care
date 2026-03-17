import type { IUserQueryRepository, UserListFilter, UserListPagination, UserListResult } from '../../domain/user/IUserQueryRepository'
import type { UserDetailDTO } from '../../domain/user/UserReadModels'

export class AdminUserQueryService {
  constructor(private queryRepo: IUserQueryRepository) {}

  async listUsers(filter: UserListFilter, pagination: UserListPagination): Promise<UserListResult> {
    return this.queryRepo.findMany(filter, pagination)
  }

  async getUserDetail(userId: string): Promise<UserDetailDTO> {
    const userEntity = await this.queryRepo.findById(userId)
    if (!userEntity) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    return {
      id: userEntity.id,
      name: userEntity.name,
      email: userEntity.email,
      image: userEntity.image,
      role: userEntity.role,
      subscriptionTier: userEntity.subscriptionTier,
      emailVerified: userEntity.emailVerified,
      banned: userEntity.banned,
      convertedFromGuest: userEntity.convertedFromGuestAt !== null,
      createdAt: userEntity.createdAt.toISOString(),
      lastLoginAt: null,
      subscriptionExpiresAt: userEntity.subscriptionExpiresAt?.toISOString() ?? null,
      updatedAt: userEntity.updatedAt.toISOString(),
    }
  }
}
