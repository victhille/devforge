/** v3.5.1: how a project's file is shown in the Files tab */
export type PreviewKind = 'markdown' | 'image' | 'pdf' | 'text'

const IMAGE: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif'
}

/** Never shown as text: archives, executables, media, office files… */
const BINARY = new Set([
  'zip', 'gz', 'tgz', 'rar', '7z', 'tar', 'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar', 'war', 'pyc', 'o', 'a', 'lib',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'wav', 'ogg', 'webm', 'mov', 'avi', 'mkv', 'flac',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'psd', 'ai', 'sketch', 'fig', 'sqlite', 'db', 'wasm'
])

/** Size limits: past them, the preview says so instead of loading the file */
export const PREVIEW_LIMIT = { text: 1024 * 1024, image: 10 * 1024 * 1024, pdf: 30 * 1024 * 1024 }

const extOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** The kind of preview a file gets from its name; null: a binary file, not shown */
export function previewKind(name: string): PreviewKind | null {
  const ext = extOf(name)
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown'
  if (ext === 'pdf') return 'pdf'
  if (IMAGE[ext]) return 'image'
  if (BINARY.has(ext)) return null
  // Dockerfile, .env, Makefile, LICENSE, code: text (checked for NUL bytes when read)
  return 'text'
}

export const imageMime = (name: string): string => IMAGE[extOf(name)] ?? 'application/octet-stream'

/** A text file has no NUL byte in its first kilobytes */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000)
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true
  return false
}
