
export const dynamic = 'force-dynamic'

export async function GET() {
  throw new Error('Sentry server test — ' + new Date().toISOString())
}
