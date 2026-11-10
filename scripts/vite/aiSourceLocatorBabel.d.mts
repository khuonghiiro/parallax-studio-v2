export declare const AI_SRC_ATTR: 'data-ai-src'
export declare function aiSourceBabelOptions(id: string): { plugins: Array<typeof aiSourceLocatorBabelPlugin> }
export declare function toProjectRelativeSource(filename: string | null | undefined): string | null
declare function aiSourceLocatorBabelPlugin(api: { types: unknown }): {
  name: string
  visitor: Record<string, unknown>
}
export default aiSourceLocatorBabelPlugin
