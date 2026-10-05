import type { McpCommand } from '@shared/ipc'
import type { Project } from '@shared/types'
import { useEditor } from '../store/editor'

export type Params = Record<string, unknown>
export type Handler = (p: Params, cmd: McpCommand) => unknown | Promise<unknown>

export class ParamError extends Error {}

export const ed = () => useEditor.getState()
export const proj = (): Project => ed().project
