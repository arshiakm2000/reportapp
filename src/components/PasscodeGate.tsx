import { type FormEvent, useId, useState } from 'react'

interface Props {
  notice?: string
  onUnlock: (passcode: string) => Promise<void>
}

export function PasscodeGate({ notice, onUnlock }: Props) {
  const fieldId = useId()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (!passcode) {
      setError('Enter the passcode.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onUnlock(passcode)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <form className="panel" onSubmit={handleSubmit}>
        <h1>Maintenance Log</h1>
        <p className="muted">{notice ?? 'Enter the passcode to open your records.'}</p>

        <div className="field">
          <label htmlFor={fieldId}>Passcode</label>
          <input
            id={fieldId}
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Checking...' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
