import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CSV_COLUMNS, type MaintenanceRecord, filterByRange, parseCsv, sortByNewest, toCsv } from './records.ts'

const awkward: MaintenanceRecord = {
  id: 'a1',
  timestamp: '2026-09-20T10:00:00.000Z',
  branch: 'BR-7',
  work_done: 'Replaced pump, cleaned filter\nSecond line "quoted"',
  parts_used: 'seal, o-ring; 2x bolt "M8"',
  created_at: '2026-09-20T10:05:00.000Z',
  updated_at: '2026-09-20T10:05:00.000Z',
}

const plain: MaintenanceRecord = {
  id: 'b2',
  timestamp: '2026-09-25T08:30:00.000Z',
  branch: '12',
  work_done: '',
  parts_used: '',
  created_at: '2026-09-25T08:30:00.000Z',
  updated_at: '2026-09-25T08:30:00.000Z',
}

test('round trips text containing commas, quotes and newlines', () => {
  assert.deepEqual(parseCsv(toCsv([awkward, plain])), [awkward, plain])
})

test('keeps the header row when there are no records', () => {
  assert.equal(toCsv([]), CSV_COLUMNS.join(','))
  assert.deepEqual(parseCsv(toCsv([])), [])
})

test('treats blank file contents as no records', () => {
  assert.deepEqual(parseCsv(''), [])
  assert.deepEqual(parseCsv('   \n'), [])
})

test('sorts newest first', () => {
  assert.deepEqual(
    sortByNewest([awkward, plain]).map((record) => record.id),
    ['b2', 'a1'],
  )
})

test('filters an inclusive timestamp range', () => {
  const within = filterByRange([awkward, plain], '2026-09-22T00:00:00.000Z', '2026-09-26T00:00:00.000Z')
  assert.deepEqual(
    within.map((record) => record.id),
    ['b2'],
  )

  assert.equal(filterByRange([awkward, plain], awkward.timestamp, plain.timestamp).length, 2)
  assert.equal(filterByRange([awkward, plain]).length, 2)
})
