import { readFile } from 'fs/promises'
import { cpus } from 'os'
import { Worker } from 'worker_threads'
import {
  getNativeWasmBytes,
  packPxsZipRust,
  sha256HexRust,
  unpackPxsZipRust
} from './pxsNativeAccel'

export interface PxsArchiveEntry {
  name: string
  data: Uint8Array
}

interface PendingJob {
  resolve: (hashes: Record<string, string>) => void
  reject: (err: unknown) => void
}

interface PoolWorker {
  worker: Worker
  busy: boolean
  currentJobId: number | null
}

const WORKER_SCRIPT = `
'use strict';
const { parentPort, workerData } = require('worker_threads');
const { readFile } = require('fs/promises');
const mod = new WebAssembly.Module(workerData.wasmBytes);
const inst = new WebAssembly.Instance(mod, {});
const exp = inst.exports;

function sha256Rust(bytes) {
  exp.wasm_scratch_reset();
  exp.wasm_scratch_reserve(32 + Math.max(16, bytes.byteLength) + 64);
  const dataPtr = bytes.byteLength > 0 ? exp.wasm_scratch_alloc(bytes.byteLength, 16) : 0;
  const outPtr = exp.wasm_scratch_alloc(32, 16);
  if (bytes.byteLength > 0) {
    new Uint8Array(exp.memory.buffer, dataPtr, bytes.byteLength).set(bytes);
  }
  const ok = exp.rust_sha256(dataPtr, bytes.byteLength, outPtr);
  if (!ok) throw new Error('rust_sha256 worker failed');
  const out = new Uint8Array(exp.memory.buffer, outPtr, 32);
  let hex = '';
  for (let i = 0; i < 32; i++) hex += out[i].toString(16).padStart(2, '0');
  return hex;
}

parentPort.on('message', async (msg) => {
  try {
    const out = {};
    for (let i = 0; i < msg.paths.length; i++) {
      const p = msg.paths[i];
      const buf = await readFile(p);
      out[p] = sha256Rust(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    }
    parentPort.postMessage({ id: msg.id, hashes: out });
  } catch (err) {
    parentPort.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
});
`

let pool: PoolWorker[] = []
let nextJobId = 1
const pendingJobs = new Map<number, PendingJob>()

function spawnPoolWorker(): PoolWorker {
  const worker = new Worker(WORKER_SCRIPT, {
    eval: true,
    workerData: { wasmBytes: getNativeWasmBytes() }
  })
  worker.unref()
  const entry: PoolWorker = { worker, busy: false, currentJobId: null }

  worker.on('message', (msg: { id: number; hashes?: Record<string, string>; error?: string }) => {
    entry.busy = false
    entry.currentJobId = null
    const pending = pendingJobs.get(msg.id)
    pendingJobs.delete(msg.id)
    if (!pending) return
    if (msg.error) pending.reject(new Error(msg.error))
    else pending.resolve(msg.hashes ?? {})
  })

  worker.on('error', (err) => {
    entry.busy = false
    const id = entry.currentJobId
    entry.currentJobId = null
    if (id !== null) {
      const pending = pendingJobs.get(id)
      pendingJobs.delete(id)
      pending?.reject(err)
    }
    pool = pool.filter((w) => w !== entry)
  })

  return entry
}

function getOrCreatePool(targetCount: number): PoolWorker[] {
  const maxWorkers = Math.max(1, Math.min(4, cpus().length || 2))
  const desired = Math.min(maxWorkers, targetCount)
  while (pool.length < desired) {
    pool.push(spawnPoolWorker())
  }
  return pool
}

function runBatchOnWorker(pw: PoolWorker, paths: string[]): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const id = nextJobId++
    pw.busy = true
    pw.currentJobId = id
    pendingJobs.set(id, { resolve, reject })
    pw.worker.postMessage({ id, paths })
  })
}

async function hashFilesDirect(filePaths: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    filePaths.map(async (p) => {
      const buf = await readFile(p)
      return [p, sha256HexRust(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))] as const
    })
  )
  return Object.fromEntries(entries)
}

export async function hashFilesParallel(filePaths: string[]): Promise<Record<string, string>> {
  if (filePaths.length === 0) return {}
  if (filePaths.length <= 2) return hashFilesDirect(filePaths)

  try {
    const workers = getOrCreatePool(Math.min(4, filePaths.length))
    const chunkCount = Math.min(workers.length, filePaths.length)
    const buckets: string[][] = Array.from({ length: chunkCount }, () => [])
    for (let i = 0; i < filePaths.length; i++) {
      buckets[i % chunkCount].push(filePaths[i])
    }
    const parts = await Promise.all(buckets.map((batch, idx) => runBatchOnWorker(workers[idx], batch)))
    return Object.assign({}, ...parts)
  } catch {
    return hashFilesDirect(filePaths)
  }
}

export async function disposeHashWorkerPool(): Promise<void> {
  const current = pool
  pool = []
  await Promise.all(current.map((pw) => pw.worker.terminate()))
}

export function packPxsArchive(entries: PxsArchiveEntry[]): Uint8Array {
  return packPxsZipRust(entries)
}

export function unpackPxsArchive(zipBytes: Uint8Array): PxsArchiveEntry[] {
  const map = unpackPxsZipRust(zipBytes)
  const out: PxsArchiveEntry[] = []
  for (const [name, data] of map.entries()) {
    out.push({ name, data })
  }
  return out
}
