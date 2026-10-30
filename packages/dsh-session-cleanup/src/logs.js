/**
 * Session log artifacts: the concatenated-frame Zstandard container the store
 * appends, its plaintext form, and the bounded header read the inventory needs.
 * This is the only module that knows how bytes in a log are encoded.
 *
 * @module dsh-better-session/cleanup/logs
 */
import { open, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

/** Zstandard frame magic, as the session log container writes it. */
const FRAME_MAGIC = 4247762216

/** One format generation of a Session log, compressed or plaintext. */
const LOG_FILE = /^session\.v(\d+)\.jsonl(\.zstd)?$/

/** How much of a log the header reader inspects; a header line is far smaller. */
const HEAD_BYTES = 64 * 1024

/**
 * Locate every complete Zstandard frame in a concatenated-frame log without
 * decompressing its blocks.
 * @param buffer - bytes currently present in the log artifact.
 * @returns `[start, end)` byte ranges of the complete frames, in file order.
 */
export function frameRanges(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== FRAME_MAGIC) {
      throw new Error(`corrupt session log: invalid Zstandard frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const headerRest = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < headerRest) break
    offset += headerRest
    let complete = true
    for (;;) {
      if (buffer.length - offset < 3) {
        complete = false
        break
      }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) {
        complete = false
        break
      }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (!complete) break
    if (checksum) {
      if (buffer.length - offset < 4) break
      offset += 4
    }
    frames.push([start, offset])
  }
  return frames
}

/**
 * Decode one session log artifact into plaintext lines.
 *
 * The whole artifact has to decode. A trailing byte range that is not a complete
 * frame may name a reference this read cannot see, and a caller that deletes
 * attachment bytes based on this text must refuse rather than guess — so the
 * tolerance `frameRanges` keeps for header reads stops here.
 * @param path - absolute log path; the suffix selects the encoding.
 * @returns the artifact plaintext.
 * @throws {Error} when the artifact ends inside a frame.
 */
export async function readLog(path) {
  const bytes = await readFile(path)
  if (!path.endsWith('.zstd')) return bytes.toString('utf8')
  const frames = frameRanges(bytes)
  const decoded = frames.length === 0 ? 0 : frames.at(-1)[1]
  if (decoded !== bytes.length) {
    throw new Error(`session log "${path}" ends inside a frame: ${bytes.length - decoded} trailing byte(s) do not decode`)
  }
  return frames
    .map(([start, end]) => zstdDecompressSync(bytes.subarray(start, end)).toString('utf8'))
    .join('')
}

/**
 * Read the first line of an artifact — the Session header — without paying for
 * the whole log.
 * @param path - absolute log path.
 * @returns the first line, or `undefined` when the artifact holds none.
 */
export async function readHeader(path) {
  const handle = await open(path, 'r')
  let bytes
  try {
    const buffer = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0)
    bytes = buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
  let text
  if (path.endsWith('.zstd')) {
    const [first] = frameRanges(bytes)
    if (first === undefined) return undefined
    text = zstdDecompressSync(bytes.subarray(first[0], first[1])).toString('utf8')
  } else {
    text = bytes.toString('utf8')
  }
  const end = text.indexOf('\n')
  return end === -1 ? text : text.slice(0, end)
}

/**
 * List the committed log artifacts of one Session directory, oldest generation
 * first.
 * @param directory - absolute Session directory.
 * @returns absolute log paths, in generation order.
 */
export async function logFiles(directory) {
  const named = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const match = LOG_FILE.exec(entry.name)
    if (match === null) continue
    named.push({ name: entry.name, generation: Number(match[1]) })
  }
  named.sort((left, right) => left.generation - right.generation)
  return named.map((entry) => join(directory, entry.name))
}
