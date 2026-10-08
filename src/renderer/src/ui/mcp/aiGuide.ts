import type { McpDocsLang } from '@shared/ipc'
import guide from '../../../../../mcp-server/catalog/guide.json'

/**
 * AI guide shown/copied in the MCP dialog. Same source file (mcp-server/catalog/guide.json)
 * as the MCP server instructions, `get_ai_guide` and `pnpm pxs guide`, so what the user
 * copies is exactly what the AI receives in the selected docs language.
 */
export const MCP_TOOL_COUNT: number = guide.toolCount

export function renderAiGuide(lang: McpDocsLang): string {
  return guide.sections
    .map((s) => [`## ${s.title[lang]}`, ...s.lines[lang]].join('\n'))
    .join('\n\n')
}
