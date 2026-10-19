import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob'
import { type MaintenanceRecord, parseCsv, toCsv } from './records.ts'

const BLOB_PATH = 'records.csv'
const MAX_WRITE_ATTEMPTS = 4

interface Snapshot {
  records: MaintenanceRecord[]
  /** Absent until the file exists; used to detect concurrent writes. */
  etag?: string
}

async function readSnapshot(): Promise<Snapshot> {
  // useCache: false so a read that immediately follows a write sees the new version.
  const result = await get(BLOB_PATH, { access: 'private', useCache: false })
  if (!result?.stream) return { records: [] }

  const text = await new Response(result.stream).text()
  // The download response carries a weak HTTP validator (W/"…"). ifMatch compares
  // the store's etag from the Blob API, so a weak tag never matches.
  let etag: string | undefined
  try {
    etag = (await head(BLOB_PATH)).etag
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) throw error
  }
  return { records: parseCsv(text), etag }
}

export async function readRecords(): Promise<MaintenanceRecord[]> {
  return (await readSnapshot()).records
}

export interface Mutation<T> {
  records: MaintenanceRecord[]
  result: T
}

/**
 * Applies a change to the whole CSV, retrying if another writer got there first.
 * The mutate callback must be pure, since it can run more than once.
 */
export async function mutateRecords<T>(
  mutate: (records: MaintenanceRecord[]) => Mutation<T>,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const snapshot = await readSnapshot()
    const { records, result } = mutate(snapshot.records)

    try {
      await put(BLOB_PATH, toCsv(records), {
        access: 'private',
        contentType: 'text/csv',
        allowOverwrite: true,
        ...(snapshot.etag ? { ifMatch: snapshot.etag } : {}),
      })
      return result
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error
      lastError = error
    }
  }

  throw lastError
}
