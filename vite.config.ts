import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function localNetlifyFunctions(): Plugin {
  return {
    name: 'local-netlify-functions',
    configureServer(server) {
      const middleware = async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/.netlify/functions/egob-sync')) {
          next()
          return
        }

        try {
          const { handler } = await import('./netlify/functions/egob-sync.mjs')
          const requestUrl = new URL(req.url, 'http://localhost')
          const result = await handler({
            queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
          })

          res.statusCode = result.statusCode || 200
          Object.entries(result.headers || {}).forEach(([key, value]) => {
            res.setHeader(key, String(value))
          })
          res.end(result.body || '')
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'No se pudo ejecutar la función local.',
          }))
        }
      }

      ;(server.middlewares as any).stack.unshift({
        route: '',
        handle: middleware,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  const basePath = env.VITE_BASE_PATH || (mode === 'production' ? '/ep-movilidad-riobamba/' : '/')

  return {
    base: basePath,
    plugins: [localNetlifyFunctions(), react()],
    server: { port: 5173, host: '0.0.0.0' },
  }
})
