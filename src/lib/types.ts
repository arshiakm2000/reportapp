/** Mirrors the columns of records.csv on the server. */
export interface MaintenanceRecord {
  id: string
  timestamp: string
  branch: string
  work_done: string
  parts_used: string
  created_at: string
  updated_at: string
}

export interface RecordDraft {
  branch: string
  work_done: string
  parts_used: string
  timestamp: string
}
