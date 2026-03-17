import type { Ref } from 'vue'

export interface ICacheEntry<T> {
  /** 快取中的資料（響應式） */
  readonly data: Ref<T>
  /** 是否正在載入 */
  readonly loading: Ref<boolean>
  /** 是否已載入過 */
  readonly loaded: Ref<boolean>
  /** 是否正在背景重新驗證（有舊資料，背景更新中） */
  readonly revalidating: Ref<boolean>
  /** 執行查詢（TTL 內返回快取，過期則重新 fetch） */
  load(force?: boolean): Promise<void>
  /** 使快取失效（下次 load 將重新 fetch） */
  invalidate(): void
}
