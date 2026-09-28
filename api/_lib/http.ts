import { createHash, timingSafeEqual } from 'node:crypto'

export const PASSCODE_HEADER = 'x-app-passcode'

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null

  // Capacitor serves the bundled app from a localhost origin, so the APK is cross-origin.
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin
  if (origin === 'capacitor://localhost') return origin

  const host = request.headers.get('host')
  return host && origin === `https://${host}` ? origin : null
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin(request)
  if (!origin) return {}

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': `content-type,${PASSCODE_HEADER}`,
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

/** Compares digests so that the passcode length is not revealed by timing. */
function passcodeMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Returns a response to send back when the request should be rejected, otherwise null. */
export function authorize(request: Request): Response | null {
  const expected = process.env.APP_PASSCODE
  if (!expected) {
    return json(request, { error: 'Server is missing the APP_PASSCODE environment variable.' }, 500)
  }

  const provided = request.headers.get(PASSCODE_HEADER) ?? ''
  if (!passcodeMatches(provided, expected)) {
    return json(request, { error: 'Incorrect passcode.' }, 401)
  }

  return null
}

export function serverError(request: Request, error: unknown): Response {
  console.error(error)
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  return json(request, { error: message }, 500)
}
