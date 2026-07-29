import scheduledEgobSync from '../netlify/functions/egob-sync-all.mjs'

try {
  const response = await scheduledEgobSync()
  const body = await response.text()
  console.log(body)
  process.exit(response.ok ? 0 : 1)
} catch (error) {
  console.error(error?.message || error)
  process.exit(1)
}
