const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '../../api/generate-and-send-report.js'),
  'utf8'
)

describe('AI report data minimisation', () => {
  test('the report lookup does not fetch participant name or role', () => {
    expect(source).toContain('select: "identity_hash,report_token,email,total_score,designation,cluster_scores,skill_scores,ai_report,report_email_sent_at,report_status,report_attempts"')
    expect(source).not.toContain('select: "identity_hash,report_token,name,role,email')
  })

  test('the Anthropic prompt accepts only anonymised score fields', () => {
    expect(source).toContain('async function generateAiReport({ valuIndex, designation, clusterScores, skillScores })')
    expect(source).toContain('Use only the de-identified score profile supplied below.')
    expect(source).not.toContain('${name}')
    expect(source).not.toContain('${role}')
    expect(source).not.toContain('name: assessment.name')
    expect(source).not.toContain('role: assessment.role')
    expect(source).not.toContain('email: assessment.email')
    expect(source).toContain('generateAiReport({ valuIndex: assessment.total_score, designation: canonicalDesignation(assessment.total_score), clusterScores: assessment.cluster_scores, skillScores: assessment.skill_scores })')
  })
})
