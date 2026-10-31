import {connectFirebase} from './firebase.mjs'
import {createAccounts} from './accounts.mjs'
import {createApiServer} from './http.mjs'

const {auth, database} = connectFirebase()
const server = createApiServer(createAccounts(auth, database), {
  origins: (process.env.ADMIN_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
})
server.requestTimeout = 30_000
server.headersTimeout = 15_000
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 8080)
server.listen(port, host, () => console.log(`English Battle backend: http://${host}:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5_000).unref()
})
