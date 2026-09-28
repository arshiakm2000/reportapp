import { type FormEvent, useId, useState } from 'react'
import { fromInputValue, nowInputValue, toInputValue } from '../lib/datetime'
import type { MaintenanceRecord, RecordDraft } from '../lib/types'

interface Props {
  /** Absent when logging a new job, present when editing an existing one. */
  initial?: MaintenanceRecord
  submitLabel: string
  busy: boolean
  onSubmit: (draft: RecordDraft) => Promise<void>
  onCancel?: () => void
}

export function RecordForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const fieldId = useId()
  const [branch, setBranch] = useState(initial?.branch ?? '')
  const [workDone, setWorkDone] = useState(initial?.work_done ?? '')
  const [partsUsed, setPartsUsed] = useState(initial?.parts_used ?? '')
  const [when, setWhen] = useState(initial ? toInputValue(initial.timestamp) : nowInputValue())
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (!branch.trim()) {
      setError('Branch number is required.')
      return
    }

    const timestamp = fromInputValue(when)
    if (!timestamp) {
      setError('Pick a valid date and time.')
      return
    }

    setError('')
    try {
      await onSubmit({
        branch: branch.trim(),
        work_done: workDone.trim(),
        parts_used: partsUsed.trim(),
        timestamp,
      })

      if (!initial) {
        setBranch('')
        setWorkDone('')
        setPartsUsed('')
        setWhen(nowInputValue())
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the record.')
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${fieldId}-branch`}>Branch number</label>
        <input
          id={`${fieldId}-branch`}
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
          placeholder="e.g. 42"
          enterKeyHint="next"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-work`}>Work done</label>
        <textarea
          id={`${fieldId}-work`}
          value={workDone}
          onChange={(event) => setWorkDone(event.target.value)}
          placeholder="What did you do?"
          rows={3}
        />
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-parts`}>Parts used</label>
        <textarea
          id={`${fieldId}-parts`}
          value={partsUsed}
          onChange={(event) => setPartsUsed(event.target.value)}
          placeholder="Which parts did you fit?"
          rows={2}
        />
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-when`}>Date and time</label>
        <div className="row">
          <input
            id={`${fieldId}-when`}
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
          <button type="button" className="ghost" onClick={() => setWhen(nowInputValue())}>
            Now
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
