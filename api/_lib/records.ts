import Papa from 'papaparse'

export const CSV_COLUMNS = [
  'id',
  'timestamp',
  'branch',
  'work_done',
  'parts_used',
  'created_at',
  'updated_at',
] as const

export interface MaintenanceRecord {
  id: string
  /** ISO 8601 instant the work was carried out. Editable by the user. */
  timestamp: string
  branch: string
  work_done: string
  parts_used: string
  created_at: string
  updated_at: string
}

export function parseCsv(text: string): MaintenanceRecord[] {
  if (!text.trim()) return []

  const { data } = Papa.parse<Partial<MaintenanceRecord>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  return data
    .filter((row): row is Partial<MaintenanceRecord> & { id: string } => Boolean(row.id))
    .map((row) => ({
      id: row.id,
      timestamp: row.timestamp ?? '',
      branch: row.branch ?? '',
      work_done: row.work_done ?? '',
      parts_used: row.parts_used ?? '',
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
    }))
}

export function toCsv(records: MaintenanceRecord[]): string {
  // Papa.unparse emits an empty string for an empty array, which would drop the header row.
  if (records.length === 0) return CSV_COLUMNS.join(',')
  return Papa.unparse(records, { columns: [...CSV_COLUMNS], newline: '\r\n' })
}

/** ISO 8601 UTC strings sort lexicographically, so newest first is a plain string compare. */
export function sortByNewest(records: MaintenanceRecord[]): MaintenanceRecord[] {
  return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function filterByRange(
  records: MaintenanceRecord[],
  from?: string,
  to?: string,
): MaintenanceRecord[] {
  return records.filter((record) => {
    if (from && record.timestamp < from) return false
    if (to && record.timestamp > to) return false
    return true
  })
}
