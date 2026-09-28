import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export type SaveOutcome = 'saved' | 'cancelled'

function isShareCancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message)
}

function downloadInBrowser(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * A cross-origin download link is ignored inside the Android webview, so on the phone
 * the file is written to app storage and handed to the system share sheet instead.
 */
export async function saveCsv(filename: string, csv: string): Promise<SaveOutcome> {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(filename, csv)
    return 'saved'
  }

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: csv,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })

  try {
    await Share.share({ title: filename, files: [uri] })
    return 'saved'
  } catch (error) {
    if (isShareCancelled(error)) return 'cancelled'
    throw error
  }
}
