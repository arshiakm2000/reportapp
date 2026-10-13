import { authorize, corsHeaders, json, preflight, serverError } from './_lib/http.ts'
import { filterByRange, toCsv } from './_lib/records.ts'
import { readRecords } from './_lib/store.ts'

/** Excel needs a byte order mark to read UTF-8 CSV correctly. */
const BOM = '\uFEFF'

function readBound(value: string | null, field: string): string | undefined {
  if (!value) return undefined

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new RangeError(`${field} is not a valid date.`)
  return parsed.toISOString()
}

function buildFilename(from?: string, to?: string): string {
  const day = (iso: string) => iso.slice(0, 10)
  if (from && to) return `maintenance-log_${day(from)}_to_${day(to)}.csv`
  if (from) return `maintenance-log_from_${day(from)}.csv`
  if (to) return `maintenance-log_to_${day(to)}.csv`
  return 'maintenance-log_all.csv'
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return preflight(request)

    const denied = authorize(request)
    if (denied) return denied

    if (request.method !== 'GET') {
      return json(request, { error: `${request.method} is not supported.` }, 405)
    }

    try {
      const params = new URL(request.url).searchParams
      const from = readBound(params.get('from'), 'from')
      const to = readBound(params.get('to'), 'to')

      if (from && to && from > to) {
        return json(request, { error: 'The start of the range is after the end.' }, 400)
      }

      // A report reads naturally oldest first, unlike the newest-first list in the app.
      const records = filterByRange(await readRecords(), from, to).sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      )

      return new Response(BOM + toCsv(records), {
        headers: {
          ...corsHeaders(request),
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${buildFilename(from, to)}"`,
          'x-record-count': String(records.length),
          'access-control-expose-headers': 'content-disposition,x-record-count',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      if (error instanceof RangeError) return json(request, { error: error.message }, 400)
      return serverError(request, error)
    }
  },
}
