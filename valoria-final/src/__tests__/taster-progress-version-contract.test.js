const fs = require('fs')
const path = require('path')

const read = relative => fs.readFileSync(path.join(__dirname, relative), 'utf8')
const migration = read('../../supabase/migrations/20261102101047_version_taster_progress_sessions.sql')
const progressApi = read('../../api/taster-progress.js')
const submitApi = read('../../api/submit-taster.js')
const gate = read('../VALUIndexV4GateNext.jsx')

describe('versioned taster persistence', () => {
  test('legacy 15-question progress is classified without changing saved answers', () => {
    expect(migration).toContain("'legacy-15'")
    expect(migration).toContain("2026-10-29 22:00:00+00")
    expect(migration).toContain("answers <> '{}'::jsonb")
    expect(migration).toContain('taster_progress_question_bounds')
    expect(migration).not.toMatch(/delete\s+from\s+public\.taster_progress/i)
  })

  test('new progress is stamped with the active taster version and question count', () => {
    expect(progressApi).toContain('taster_version: VALU_VERSION')
    expect(progressApi).toContain('total_questions: TASTER_QUESTIONS.length')
    expect(progressApi).toContain('progress.taster_version !== VALU_VERSION')
    expect(progressApi).toContain('Number(progress.total_questions) !== TASTER_QUESTIONS.length')
  })

  test('legacy sessions cannot be saved or submitted as the current taster', () => {
    expect(progressApi).toContain("code: 'LEGACY_TASTER_VERSION'")
    expect(submitApi).toContain('progress.taster_version !== VALU_VERSION')
    expect(submitApi).toContain("code: 'LEGACY_TASTER_VERSION'")
  })

  test('the client preserves legacy tokens and asks before starting the current nine', () => {
    expect(gate).toContain('LEGACY_RESUME_TOKENS_KEY')
    expect(gate).toContain("setPhase('legacy')")
    expect(gate).toContain('Your earlier progress is preserved.')
    expect(gate).toContain('START THE CURRENT 9-QUESTION OPENING')
    expect(gate).toContain('https://www.valoriainstitute.com')
  })
})
