const fs = require('fs')
const path = require('path')

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8')

describe('staging assessment navigation isolation', () => {
  test('accepts the isolated staging site origin and renders the staging notice', () => {
    const navigation = read('src/AssessmentNavigation.jsx')
    expect(navigation).toContain('valoria-staging-site.riverwayse.workers.dev')
    expect(navigation).toContain('import.meta.env.VITE_VALU_SITE_ORIGIN')
    expect(navigation).toContain("const IS_STAGING = import.meta.env.VITE_VALU_STAGING === '1'")
    expect(navigation).toContain('src={`${siteUrl}/logo.png`}')
    expect(navigation).toContain('STAGING PREVIEW · NOT PRODUCTION')
  })

  test('staging build points both assessment and site origins to isolated Workers', () => {
    const workflow = read('.github/workflows/cloudflare-assessment-staging-deploy.yml')
    expect(workflow).toContain('VITE_VALU_STAGING: "1"')
    expect(workflow).toContain('VITE_VALU_API_ORIGIN: "https://valoria-staging-assessment.riverwayse.workers.dev"')
    expect(workflow).toContain('VITE_VALU_SITE_ORIGIN: "https://valoria-staging-site.riverwayse.workers.dev"')
  })
})
