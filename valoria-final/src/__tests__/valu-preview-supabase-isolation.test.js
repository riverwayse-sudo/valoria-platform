const fs = require('fs')
const path = require('path')

const helper = fs.readFileSync(
  path.join(__dirname, '../../lib/valoria-supabase-runtime-config.js'),
  'utf8'
)

describe('Cloudflare preview Supabase isolation', () => {
  test('both Cloudflare preview flags force preview-only credentials', () => {
    expect(helper).toContain("env.VALU_PREVIEW === '1'")
    expect(helper).toContain("env.CF_WORKERS_PREVIEW === '1'")
    expect(helper).toContain('if (isPreview)')
    expect(helper).toContain('VALU_PREVIEW_SUPABASE_URL')
    expect(helper).toContain('VALU_PREVIEW_SUPABASE_SERVICE_ROLE_KEY')
  })

  test('preview configuration fails closed when preview credentials are absent', () => {
    expect(helper).toContain('if (!url || !serviceRoleKey) return null')
  })
})
