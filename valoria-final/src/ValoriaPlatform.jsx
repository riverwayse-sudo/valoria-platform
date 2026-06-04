import { useCallback, useEffect, useState } from 'react';
import PRIMEAssessment from './PRIMEAssessment.jsx';
import {
  getAssessmentLock,
  resolveLockForIdentity,
  setAssessmentLock,
  computeFingerprint,
} from './assessmentLock.js';

export default function ValoriaPlatform() {
  const [assessmentLockRecord, setAssessmentLockRecord] = useState(null);

  useEffect(() => {
    const lock = getAssessmentLock();
    if (lock) setAssessmentLockRecord(lock);
  }, []);

  const handleIdentityChange = useCallback(async (name, role) => {
    const record = await resolveLockForIdentity(name, role);
    setAssessmentLockRecord(record);
  }, []);

  function persistLock(results) {
    const fingerprint = computeFingerprint(results.name, results.role);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const record = {
      fingerprint,
      expiresAt: expiresAt.toISOString(),
      completedAt: results.completedAt || new Date().toISOString(),
    };
    setAssessmentLock(record);
    setAssessmentLockRecord(record);
  }

  return (
    <PRIMEAssessment
      onIdentityChange={handleIdentityChange}
      onAssessmentSubmitted={persistLock}
      onComplete={persistLock}
      assessmentLockRecord={assessmentLockRecord}
    />
  );
}
