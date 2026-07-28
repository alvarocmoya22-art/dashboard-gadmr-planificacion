import scheduledEgobSync from '../netlify/functions/egob-sync-all.mjs'

try {
  const response = await scheduledEgobSync()
  const body = await response.text()
  console.log(body)
  if (!response.ok) {
    process.exitCode = 1
  }
} catch (error) {
  console.error(error?.message || error)
  process.exitCode = 1
}
