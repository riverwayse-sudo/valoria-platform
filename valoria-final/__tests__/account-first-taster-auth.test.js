const fs = require('fs')
const path = require('path')

describe('account-first professional taster handoff', () => {
  test('authenticated taster journey restores the site session and avoids a second signup', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/VALUIndexV4GateNext.jsx'), 'utf8')
    expect(source).toContain("sessionStorage.getItem('valoria-assessment-auth')")
    expect(source).toContain("accountAuth.user?.display_name")
    expect(source).toContain("accountAuth.user?.email")
    expect(source).toContain('setAuthenticatedAccount(true)')
    expect(source).toContain('readOnly aria-readonly="true"')
    expect(source).toContain("Authorization:'Bearer '+authBridge.access_token")
    expect(source).toContain("fetch('/api/link-taster'")
    expect(source).toContain("window.location.assign('/dashboard?welcome=profile')")
    expect(source).not.toContain("sessionStorage.setItem('valoria-assessment-auth'")
  })
})
