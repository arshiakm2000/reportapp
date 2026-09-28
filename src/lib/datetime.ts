function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Renders an ISO instant as the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in device time. */
export function toInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function nowInputValue(): string {
  return toInputValue(new Date().toISOString())
}

/** A datetime-local value carries no offset, so it is interpreted as local wall time. */
export function fromInputValue(value: string): string | null {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatForDisplay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso || 'Unknown time'

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
