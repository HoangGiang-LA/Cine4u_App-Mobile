import {createServer} from 'node:http'
import {ApiError} from './accounts.mjs'

const statuses = {UNAUTHENTICATED: 401, PERMISSION_DENIED: 403, INVALID_ARGUMENT: 400, FAILED_PRECONDITION: 409, UNIMPLEMENTED: 501, NOT_FOUND: 404, DEADLINE_EXCEEDED: 504}

export function createApiServer(accounts, {origins = [], logError = console.error, timeoutMs = 20_000} = {}) {
  async function bounded(operation) {
    let timer
    try {
      return await Promise.race([operation, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ApiError('DEADLINE_EXCEEDED', 'The server did not respond in time.')), timeoutMs)
        timer.unref()
      })])
    } finally { clearTimeout(timer) }
  }
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Vary', 'Origin')
    const origin = request.headers.origin
    if (origin && !origins.includes(origin)) {
      response.writeHead(403).end(JSON.stringify({error: {status: 'PERMISSION_DENIED', message: 'Origin is not allowed.'}}))
      return
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({status: 'ok'})); return
    }
    try {
      const match = /^\/api\/([A-Za-z][A-Za-z0-9]*)$/.exec(request.url || '')
      if (request.method !== 'POST' || !match) throw new ApiError('NOT_FOUND', 'Endpoint not found.')
      const bearer = /^Bearer (\S+)$/.exec(request.headers.authorization || '')
      if (!bearer) throw new ApiError('UNAUTHENTICATED', 'Sign in first.')
      const identity = await bounded(accounts.authenticate(bearer[1]))
      const chunks = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > 65_536) throw new ApiError('INVALID_ARGUMENT', 'Request is too large.')
        chunks.push(chunk)
      }
      let parsed
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError('INVALID_ARGUMENT', 'Invalid JSON.') }
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' ||
          Object.keys(parsed).some(key => key !== 'data')) throw new ApiError('INVALID_ARGUMENT', 'Expected a data object.')
      const result = await bounded(accounts.execute(match[1], parsed.data, identity))
      response.end(JSON.stringify({result}))
    } catch (error) {
      const known = error instanceof ApiError
      if (!known) logError('Backend request failed:', error.code || error.name)
      response.writeHead(known ? (statuses[error.status] || 500) : 500).end(JSON.stringify({error: {
        status: known ? error.status : 'INTERNAL',
        message: known ? error.message : 'The request could not be completed.',
        ...(known && error.details ? {details: error.details} : {}),
      }}))
    }
  })
}
