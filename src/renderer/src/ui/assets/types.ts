import type { BuiltInAssetCategory, BuiltInAssetItem } from '@shared/ipc'

export interface BuiltInAssetFilter {
  selectedCategory: string
  searchQuery: string
}

export function sortAssetCategories(categories: BuiltInAssetCategory[]): BuiltInAssetCategory[] {
  return [...categories].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 9999
    const orderB = typeof b.order === 'number' ? b.order : 9999
    if (orderA !== orderB) return orderA - orderB
    const nameA = (a.title || a.id).trim()
    const nameB = (b.title || b.id).trim()
    return nameA.localeCompare(nameB, 'vi')
  })
}

export type { BuiltInAssetCategory, BuiltInAssetItem }
