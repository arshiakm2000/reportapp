import { randomUUID } from 'node:crypto'
import { authorize, json, preflight, serverError } from './_lib/http'
import { type MaintenanceRecord, sortByNewest } from './_lib/records'
import { mutateRecords, readRecords } from './_lib/store'

const MAX_BRANCH_LENGTH = 64
const MAX_NOTE_LENGTH = 5000

class NotFoundError extends Error {}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

interface RecordFields {
  branch: string
  work_done: string
  parts_used: string
  timestamp: string
}

function readText(value: unknown, field: string, maxLength: number): Parsed<string> {
  if (value === undefined || value === null) return { ok: true, value: '' }
  if (typeof value !== 'string') return { ok: false, error: `${field} must be text.` }

  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${field} must be ${maxLength} characters or fewer.` }
  }
  return { ok: true, value: trimmed }
}

function readTimestamp(value: unknown): Parsed<string> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: new Date().toISOString() }
  }
  if (typeof value !== 'string') return { ok: false, error: 'timestamp must be an ISO 8601 string.' }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'timestamp is not a valid date.' }
  return { ok: true, value: parsed.toISOString() }
}

function parseFields(body: unknown): Parsed<RecordFields> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Expected a JSON object.' }
  }
  const input = body as Record<string, unknown>

  const branch = readText(input.branch, 'branch', MAX_BRANCH_LENGTH)
  if (!branch.ok) return branch
  if (!branch.value) return { ok: false, error: 'branch is required.' }

  const workDone = readText(input.work_done, 'work_done', MAX_NOTE_LENGTH)
  if (!workDone.ok) return workDone

  const partsUsed = readText(input.parts_used, 'parts_used', MAX_NOTE_LENGTH)
  if (!partsUsed.ok) return partsUsed

  const timestamp = readTimestamp(input.timestamp)
  if (!timestamp.ok) return timestamp

  return {
    ok: true,
    value: {
      branch: branch.value,
      work_done: workDone.value,
      parts_used: partsUsed.value,
      timestamp: timestamp.value,
    },
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function handleList(request: Request): Promise<Response> {
  return json(request, { records: sortByNewest(await readRecords()) })
}

async function handleCreate(request: Request): Promise<Response> {
  const fields = parseFields(await readJson(request))
  if (!fields.ok) return json(request, { error: fields.error }, 400)

  const now = new Date().toISOString()
  const record: MaintenanceRecord = {
    id: randomUUID(),
    ...fields.value,
    created_at: now,
    updated_at: now,
  }

  await mutateRecords((records) => ({ records: [...records, record], result: null }))
  return json(request, { record }, 201)
}

async function handleUpdate(request: Request, id: string): Promise<Response> {
  const fields = parseFields(await readJson(request))
  if (!fields.ok) return json(request, { error: fields.error }, 400)

  const record = await mutateRecords((records) => {
    const index = records.findIndex((candidate) => candidate.id === id)
    if (index === -1) throw new NotFoundError()

    const updated: MaintenanceRecord = {
      ...records[index],
      ...fields.value,
      updated_at: new Date().toISOString(),
    }
    const next = [...records]
    next[index] = updated
    return { records: next, result: updated }
  })

  return json(request, { record })
}

async function handleDelete(request: Request, id: string): Promise<Response> {
  await mutateRecords((records) => {
    const next = records.filter((candidate) => candidate.id !== id)
    if (next.length === records.length) throw new NotFoundError()
    return { records: next, result: null }
  })

  return json(request, { ok: true })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return preflight(request)

    const denied = authorize(request)
    if (denied) return denied

    try {
      if (request.method === 'GET') return await handleList(request)
      if (request.method === 'POST') return await handleCreate(request)

      if (request.method === 'PUT' || request.method === 'DELETE') {
        const id = new URL(request.url).searchParams.get('id')
        if (!id) return json(request, { error: 'Missing id query parameter.' }, 400)

        return request.method === 'PUT'
          ? await handleUpdate(request, id)
          : await handleDelete(request, id)
      }

      return json(request, { error: `${request.method} is not supported.` }, 405)
    } catch (error) {
      if (error instanceof NotFoundError) return json(request, { error: 'Record not found.' }, 404)
      return serverError(request, error)
    }
  },
}
