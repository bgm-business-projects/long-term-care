import type { UserListItemDTO } from './UserReadModels'
import type { UserEntity } from './UserEntity'

export interface UserListFilter {
  search?: string
  role?: string
  tier?: string
  convertedFromGuest?: boolean
}

export interface UserListPagination {
  page: number
  pageSize: number
  sortBy?: 'createdAt' | 'name' | 'email'
  sortOrder?: 'asc' | 'desc'
}

export interface UserListResult {
  items: UserListItemDTO[]
  total: number
}

export interface IUserQueryRepository {
  findMany(filter: UserListFilter, pagination: UserListPagination): Promise<UserListResult>
  findById(id: string): Promise<UserEntity | null>
}
