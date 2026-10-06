import type { BuiltInAssetCategory, BuiltInAssetItem } from '@shared/ipc'

export interface BuiltInAssetFilter {
  selectedCategory: string
  searchQuery: string
}

export type { BuiltInAssetCategory, BuiltInAssetItem }
