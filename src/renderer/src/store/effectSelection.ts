import { create } from 'zustand'
import { useEditor } from './editor'

export const useEffectSelection = create<{ layerId: string | null; effectId: string | null;
  select: (layerId: string, effectId: string) => void }>((set) => ({
  layerId: null, effectId: null,
  select: (layerId, effectId) => {
    useEditor.getState().selectLayer(layerId)
    useEditor.getState().setInspectorTab('layer')
    set({ layerId, effectId })
  }
}))
