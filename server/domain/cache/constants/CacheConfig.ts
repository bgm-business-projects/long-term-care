export const CACHE_KEYS = {
  session: (token: string) => `session:${token}`,
  userSessions: (userId: string) => `user-sessions:${userId}`,
  subscription: (userId: string) => `sub:${userId}`,
  feed: (sort: string) => `feed:${sort}`,
} as const

export const CACHE_TTL = {
  session: 300, // 5 min
  subscription: 120, // 2 min
  feed: 300, // 5 min
} as const
