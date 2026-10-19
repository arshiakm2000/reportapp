import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob'
import { type MaintenanceRecord, parseCsv, toCsv } from './records.ts'

const BLOB_PATH = 'records.csv'
const MAX_WRITE_ATTEMPTS = 4

interface Snapshot {
  records: MaintenanceRecord[]
  /** Absent until the file exists; used to detect concurrent writes. */
  etag?: string
}

function etagShape(etag: string | undefined): {
  present: boolean
  length: number
  quoted: boolean
  weak: boolean
} {
  return {
    present: Boolean(etag),
    length: etag?.length ?? 0,
    quoted: etag?.startsWith('"') ?? false,
    weak: etag?.startsWith('W/') ?? false,
  }
}

async function readSnapshot(): Promise<Snapshot> {
  // useCache: false so a read that immediately follows a write sees the new version.
  const result = await get(BLOB_PATH, { access: 'private', useCache: false })
  // #region agent log
  fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'pre-fix',hypothesisId:'A-C-E',location:'api/_lib/store.ts:readSnapshot',message:'blob read',data:{statusCode:result && 'statusCode' in result ? result.statusCode : null,hasStream:Boolean(result?.stream),etag:etagShape(result?.blob?.etag)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'post-fix',hypothesisId:'A',location:'api/_lib/store.ts:readSnapshot',message:'store etag chosen',data:{download:etagShape(result.blob.etag),store:etagShape(etag)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  let lastShape = etagShape(undefined)

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const snapshot = await readSnapshot()
    lastShape = etagShape(snapshot.etag)
    const { records, result } = mutate(snapshot.records)

    try {
      // #region agent log
      fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'pre-fix',hypothesisId:'A-D',location:'api/_lib/store.ts:mutateRecords',message:'blob write attempt',data:{attempt,recordCount:records.length,sendsIfMatch:Boolean(snapshot.etag),etag:etagShape(snapshot.etag)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await put(BLOB_PATH, toCsv(records), {
        access: 'private',
        contentType: 'text/csv',
        allowOverwrite: true,
        ...(snapshot.etag ? { ifMatch: snapshot.etag } : {}),
      })
      // #region agent log
      fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'pre-fix',hypothesisId:'C',location:'api/_lib/store.ts:mutateRecords',message:'blob write succeeded',data:{attempt},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'pre-fix',hypothesisId:'B',location:'api/_lib/store.ts:mutateRecords',message:'blob write failed',data:{attempt,isPrecondition:error instanceof BlobPreconditionFailedError,errorName:error instanceof Error ? error.name : typeof error},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!(error instanceof BlobPreconditionFailedError)) throw error
      lastError = error
    }
  }

  const detail = `etag present=${lastShape.present} length=${lastShape.length} quoted=${lastShape.quoted} weak=${lastShape.weak}`
  // #region agent log
  console.error('blob write gave up', detail)
  fetch('http://127.0.0.1:7271/ingest/bac3925b-30c1-47d9-921d-95ac9e4260ae',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e51152'},body:JSON.stringify({sessionId:'e51152',runId:'pre-fix',hypothesisId:'A-C',location:'api/_lib/store.ts:mutateRecords',message:'blob write gave up',data:{detail},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const message = lastError instanceof Error ? lastError.message : 'Write failed'
  throw new Error(`${message} [${detail}]`)
}
