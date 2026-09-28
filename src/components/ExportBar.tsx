import { useId, useState } from 'react'
import type { ExportRange } from '../lib/api'
import { fromInputValue } from '../lib/datetime'

interface Props {
  disabled: boolean
  onDownload: (range: ExportRange) => Promise<string>
}

export function ExportBar({ disabled, onDownload }: Props) {
  const fieldId = useId()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  async function run(range: ExportRange) {
    setWorking(true)
    setError('')
    setStatus('')
    try {
      setStatus(await onDownload(range))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the report.')
    } finally {
      setWorking(false)
    }
  }

  function downloadRange() {
    const fromIso = fromInputValue(from) ?? undefined
    const toIso = fromInputValue(to) ?? undefined

    if (!fromIso && !toIso) {
      setError('Pick at least one end of the range.')
      return
    }
    if (fromIso && toIso && fromIso > toIso) {
      setError('The start of the range is after the end.')
      return
    }

    void run({ from: fromIso, to: toIso })
  }

  const blocked = disabled || working

  return (
    <section className="panel">
      <h2>Download report</h2>

      <div className="range">
        <div className="field">
          <label htmlFor={`${fieldId}-from`}>From</label>
          <input
            id={`${fieldId}-from`}
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-to`}>To</label>
          <input
            id={`${fieldId}-to`}
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="status">{status}</p>}

      <div className="row">
        <button type="button" className="primary" onClick={downloadRange} disabled={blocked}>
          {working ? 'Preparing...' : 'Download range'}
        </button>
        <button type="button" className="ghost" onClick={() => void run({})} disabled={blocked}>
          Download everything
        </button>
      </div>
    </section>
  )
}
