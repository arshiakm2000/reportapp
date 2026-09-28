import { useCallback, useEffect, useState } from 'react'
import { ExportBar } from './components/ExportBar'
import { PasscodeGate } from './components/PasscodeGate'
import { RecordForm } from './components/RecordForm'
import { RecordList } from './components/RecordList'
import {
  ApiError,
  type ExportRange,
  clearPasscode,
  createRecord,
  deleteRecord,
  exportCsv,
  getPasscode,
  listRecords,
  setPasscode,
  updateRecord,
} from './lib/api'
import { saveCsv } from './lib/download'
import type { MaintenanceRecord, RecordDraft } from './lib/types'

type Phase = 'locked' | 'loading' | 'ready' | 'error'

const byNewest = (a: MaintenanceRecord, b: MaintenanceRecord) => b.timestamp.localeCompare(a.timestamp)

export default function App() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [phase, setPhase] = useState<Phase>(() => (getPasscode() ? 'loading' : 'locked'))
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lock = useCallback((message: string) => {
    clearPasscode()
    setRecords([])
    setNotice(message)
    setPhase('locked')
  }, [])

  const fetchRecords = useCallback(async () => {
    try {
      setRecords((await listRecords()).sort(byNewest))
      setPhase('ready')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        lock('That passcode was not accepted. Try again.')
        return
      }
      setError(cause instanceof Error ? cause.message : 'Could not load your records.')
      setPhase('error')
    }
  }, [lock])

  const reload = useCallback(() => {
    setPhase('loading')
    setError('')
    return fetchRecords()
  }, [fetchRecords])

  // Loading the records is exactly the "synchronise with an external system" case an effect is
  // for; the state it writes lands after the request resolves, not during the render pass.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (getPasscode()) void fetchRecords()
  }, [fetchRecords])

  /** Runs a change against the server, dropping back to the gate if the passcode stops working. */
  async function mutate(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        lock('Your passcode is no longer accepted. Enter it again.')
      }
      throw cause
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock(passcode: string) {
    setPasscode(passcode)
    setNotice(undefined)
    await reload()
  }

  const handleCreate = (draft: RecordDraft) =>
    mutate(async () => {
      const record = await createRecord(draft)
      setRecords((current) => [record, ...current].sort(byNewest))
    })

  const handleSave = (id: string, draft: RecordDraft) =>
    mutate(async () => {
      const record = await updateRecord(id, draft)
      setRecords((current) => current.map((item) => (item.id === id ? record : item)).sort(byNewest))
    })

  const handleDelete = (id: string) =>
    mutate(async () => {
      await deleteRecord(id)
      setRecords((current) => current.filter((item) => item.id !== id))
    })

  async function handleDownload(range: ExportRange): Promise<string> {
    try {
      const { filename, csv, count } = await exportCsv(range)
      if (count === 0) return 'No jobs fall in that range.'

      const outcome = await saveCsv(filename, csv)
      if (outcome === 'cancelled') return 'Download cancelled.'
      return `Saved ${filename} with ${count} ${count === 1 ? 'job' : 'jobs'}.`
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        lock('Your passcode is no longer accepted. Enter it again.')
      }
      throw cause
    }
  }

  if (phase === 'locked') {
    return <PasscodeGate notice={notice} onUnlock={handleUnlock} />
  }

  return (
    <main className="app">
      <header className="app-head">
        <h1>Maintenance Log</h1>
        <div className="row">
          <span className="muted">
            {records.length} {records.length === 1 ? 'job' : 'jobs'}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => void reload()}
            disabled={phase === 'loading' || busy}
          >
            Refresh
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => lock('Locked. Enter the passcode to continue.')}
          >
            Lock
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Log a job</h2>
        <RecordForm submitLabel="Add record" busy={busy} onSubmit={handleCreate} />
      </section>

      <ExportBar disabled={busy} onDownload={handleDownload} />

      <section className="panel">
        <h2>History</h2>
        {error && <p className="error">{error}</p>}
        {phase === 'loading' ? (
          <p className="muted">Loading your records...</p>
        ) : (
          <RecordList
            records={records}
            busy={busy}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </section>
    </main>
  )
}
