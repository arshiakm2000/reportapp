import { useState } from 'react'
import { formatForDisplay } from '../lib/datetime'
import type { MaintenanceRecord, RecordDraft } from '../lib/types'
import { RecordForm } from './RecordForm'

interface CardProps {
  record: MaintenanceRecord
  busy: boolean
  onSave: (id: string, draft: RecordDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function RecordCard({ record, busy, onSave, onDelete }: CardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    try {
      await onDelete(record.id)
    } catch (cause) {
      setConfirmingDelete(false)
      setError(cause instanceof Error ? cause.message : 'Could not delete the record.')
    }
  }

  if (editing) {
    return (
      <li className="card editing">
        <RecordForm
          initial={record}
          submitLabel="Save changes"
          busy={busy}
          onSubmit={async (draft) => {
            await onSave(record.id, draft)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="card">
      <div className="card-head">
        <span className="branch">Branch {record.branch}</span>
        <time dateTime={record.timestamp}>{formatForDisplay(record.timestamp)}</time>
      </div>

      {record.work_done && (
        <div className="card-section">
          <span className="card-label">Work done</span>
          <p>{record.work_done}</p>
        </div>
      )}

      {record.parts_used && (
        <div className="card-section">
          <span className="card-label">Parts used</span>
          <p>{record.parts_used}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row card-actions">
        <button type="button" className="ghost" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </button>

        {confirmingDelete ? (
          <>
            <button type="button" className="danger" disabled={busy} onClick={() => void handleDelete()}>
              Really delete
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  )
}

interface Props {
  records: MaintenanceRecord[]
  busy: boolean
  onSave: (id: string, draft: RecordDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function RecordList({ records, busy, onSave, onDelete }: Props) {
  if (records.length === 0) {
    return <p className="empty">No jobs logged yet. Add your first one above.</p>
  }

  return (
    <ul className="record-list">
      {records.map((record) => (
        <RecordCard
          key={record.id}
          record={record}
          busy={busy}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
