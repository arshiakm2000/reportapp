import type { MaintenanceRecord, RecordDraft } from './types'

/** Empty on the website (same origin); set to the Vercel URL for the bundled Android build. */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const PASSCODE_KEY = 'maintenance-log.passcode'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getPasscode(): string {
  return localStorage.getItem(PASSCODE_KEY) ?? ''
}

export function setPasscode(value: string): void {
  localStorage.setItem(PASSCODE_KEY, value)
}

export function clearPasscode(): void {
  localStorage.removeItem(PASSCODE_KEY)
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error
    }
  } catch {
    // Body was not JSON; fall back to a generic message.
  }
  return `Request failed with status ${response.status}.`
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        'x-app-passcode': getPasscode(),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0)
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response
}

export async function listRecords(): Promise<MaintenanceRecord[]> {
  const response = await request('/api/records')
  const body = (await response.json()) as { records: MaintenanceRecord[] }
  return body.records
}

export async function createRecord(draft: RecordDraft): Promise<MaintenanceRecord> {
  const response = await request('/api/records', { method: 'POST', body: JSON.stringify(draft) })
  const body = (await response.json()) as { record: MaintenanceRecord }
  return body.record
}

export async function updateRecord(id: string, draft: RecordDraft): Promise<MaintenanceRecord> {
  const response = await request(`/api/records?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  })
  const body = (await response.json()) as { record: MaintenanceRecord }
  return body.record
}

export async function deleteRecord(id: string): Promise<void> {
  await request(`/api/records?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export interface ExportRange {
  from?: string
  to?: string
}

function filenameFrom(disposition: string | null): string | null {
  const match = disposition?.match(/filename="([^"]+)"/)
  return match ? match[1] : null
}

export interface ExportResult {
  filename: string
  csv: string
  count: number
}

export async function exportCsv(range: ExportRange): Promise<ExportResult> {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)

  const query = params.toString()
  const response = await request(`/api/export${query ? `?${query}` : ''}`)

  return {
    filename: filenameFrom(response.headers.get('content-disposition')) ?? 'maintenance-log.csv',
    csv: await response.text(),
    count: Number(response.headers.get('x-record-count') ?? 0),
  }
}
