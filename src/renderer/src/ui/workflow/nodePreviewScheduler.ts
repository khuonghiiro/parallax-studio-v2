/** Coalesce continuous edits; callbacks always evaluate the latest draft only once. */
export function createNodePreviewScheduler(delay = 80) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: (() => void) | undefined
  const cancel = () => { clearTimeout(timer); timer = undefined; pending = undefined }
  const flush = () => {
    clearTimeout(timer); timer = undefined
    const run = pending; pending = undefined
    run?.()
  }
  return {
    schedule(run: () => void, immediate = false) {
      cancel(); pending = run; timer = setTimeout(flush, immediate ? 0 : delay)
    },
    cancel,
    flush
  }
}
