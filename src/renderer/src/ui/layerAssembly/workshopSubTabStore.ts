import { useSyncExternalStore } from 'react'

export type LayerSubTab = 'stack' | 'transform' | 'depth' | 'parts' | 'cloth'
export type RigSubTab = 'hierarchy' | 'build' | 'binding' | 'autorig'
export type AnimInspectorSubTab = 'pose' | 'clips' | 'physics'
export type WindPanelSubTab = 'spines' | 'create' | 'harmony'
export type LoopSubTab = 'template' | 'playback' | 'rhythm'

export type AnySubTab =
  | LayerSubTab
  | RigSubTab
  | AnimInspectorSubTab
  | WindPanelSubTab
  | LoopSubTab

export interface WorkshopSubTabMap {
  layers: LayerSubTab
  bones: RigSubTab
  animation: AnimInspectorSubTab
  plant: WindPanelSubTab
  loop: LoopSubTab
}

export type WorkshopTabKey = keyof WorkshopSubTabMap

const DEFAULTS: WorkshopSubTabMap = {
  layers: 'stack',
  bones: 'hierarchy',
  animation: 'pose',
  plant: 'spines',
  loop: 'template'
}

let currentTabs: WorkshopSubTabMap = { ...DEFAULTS }
const listeners = new Set<() => void>()

export function getWorkshopSubTabs(): WorkshopSubTabMap {
  return currentTabs
}

export function getWorkshopSubTab<K extends WorkshopTabKey>(tab: K): WorkshopSubTabMap[K] {
  return currentTabs[tab]
}

export function setWorkshopSubTab<K extends WorkshopTabKey>(
  tab: K,
  subTab: WorkshopSubTabMap[K]
): void {
  if (currentTabs[tab] === subTab) return
  currentTabs = { ...currentTabs, [tab]: subTab }
  listeners.forEach((l) => l())
}

export function setAnyWorkshopSubTab(tab: string, subTab: string): boolean {
  const validTabs: WorkshopTabKey[] = ['layers', 'bones', 'animation', 'plant', 'loop']
  if (!validTabs.includes(tab as WorkshopTabKey)) return false
  const t = tab as WorkshopTabKey
  const validSubTabs: Record<WorkshopTabKey, string[]> = {
    layers: ['stack', 'transform', 'depth', 'parts', 'cloth'],
    bones: ['hierarchy', 'build', 'binding', 'autorig'],
    animation: ['pose', 'clips', 'physics'],
    plant: ['spines', 'create', 'harmony'],
    loop: ['template', 'playback', 'rhythm']
  }
  if (!validSubTabs[t].includes(subTab)) return false
  setWorkshopSubTab(t, subTab as any)
  return true
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWorkshopSubTabs(): WorkshopSubTabMap {
  return useSyncExternalStore(subscribe, getWorkshopSubTabs, getWorkshopSubTabs)
}

export function useWorkshopSubTab<K extends WorkshopTabKey>(
  tab: K
): [WorkshopSubTabMap[K], (val: WorkshopSubTabMap[K]) => void] {
  const tabs = useWorkshopSubTabs()
  const setter = (val: WorkshopSubTabMap[K]) => setWorkshopSubTab(tab, val)
  return [tabs[tab], setter]
}
