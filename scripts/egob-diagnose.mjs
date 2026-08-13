import { diagnoseIssue, diagnoseRaw, diagnoseJson, diagnosePdf } from '../netlify/functions/egob-sync.mjs'

const MODE = process.env.DIAG_MODE || 'full'

const issues = String(process.env.DIAG_ISSUES || '')
  .split(/[\s,]+/)
  .map((value) => value.replace(/\D/g, ''))
  .filter(Boolean)

if (!issues.length) {
  console.error('Define DIAG_ISSUES (ej: "914830,295460,1155221").')
  process.exit(1)
}

for (const issue of issues) {
  console.log(`\n\n############### DIAGNÓSTICO eGob ${issue} (modo ${MODE}) ###############`)
  try {
    const result = MODE === 'raw' ? await diagnoseRaw(issue)
      : MODE === 'json' ? await diagnoseJson(issue)
      : MODE === 'pdf' ? await diagnosePdf(issue)
      : await diagnoseIssue(issue)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`ERROR ${issue}:`, error?.message || error)
  }
}
