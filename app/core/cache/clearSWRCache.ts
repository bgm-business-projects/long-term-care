import { cacheStorage } from './localStorageStorage'

export function clearSWRCache(): void {
  cacheStorage.clearAllWithPrefix('myapp-swr:')
}
