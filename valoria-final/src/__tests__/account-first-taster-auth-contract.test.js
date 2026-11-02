const fs = require('fs')
const path = require('path')

const read = relative => fs.readFileSync(path.join(__dirname, relative), 'utf8')
const gate = read('../VALUIndexV4GateNext.jsx')

describe('account-first taster entry contract', () => {
  test('assessment entry requires the same-origin authenticated start bridge', () => {
    expect(gate).toContain("sessionStorage.getItem('valoria-assessment-auth')")
    expect(gate).toContain("window.location.replace((SITE_BASE?SITE_BASE:'')+'/assessment/start')")
    expect(gate).toContain('bridgeFresh')
  })

  test('authenticated participants link saved tasters to their account', () => {
    expect(gate).toContain("fetch('/api/link-taster'")
    expect(gate).toContain("Authorization:'Bearer '+accountAuth.access_token")
    expect(gate).toContain("window.location.assign('/dashboard?welcome=profile')")
  })

  test('the authenticated account email cannot be changed at the assessment break', () => {
    expect(gate).toContain('authenticatedAccount ? <Field label="ACCOUNT EMAIL"')
    expect(gate).toContain('readOnly aria-readonly="true"')
  })

  test('legacy sessions are preserved and cannot be silently mixed with the current opening', () => {
    expect(gate).toContain('LEGACY_RESUME_TOKENS_KEY')
    expect(gate).toContain("setPhase('legacy')")
    expect(gate).toContain('Your earlier progress is preserved.')
    expect(gate).toContain('START THE CURRENT 9-QUESTION OPENING')
  })
})
