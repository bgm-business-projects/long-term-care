export interface UserListItemDTO {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  subscriptionTier: string
  emailVerified: boolean
  banned: boolean
  convertedFromGuest: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface UserDetailDTO extends UserListItemDTO {
  subscriptionExpiresAt: string | null
  updatedAt: string
}
