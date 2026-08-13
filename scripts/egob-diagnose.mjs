import { diagnoseIssue } from '../netlify/functions/egob-sync.mjs'

const issues = String(process.env.DIAG_ISSUES || '')
  .split(/[\s,]+/)
  .map((value) => value.replace(/\D/g, ''))
  .filter(Boolean)

if (!issues.length) {
  console.error('Define DIAG_ISSUES (ej: "914830,295460,1155221").')
  process.exit(1)
}

for (const issue of issues) {
  console.log(`\n\n############### DIAGNÓSTICO eGob ${issue} ###############`)
  try {
    const result = await diagnoseIssue(issue)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`ERROR ${issue}:`, error?.message || error)
  }
}
