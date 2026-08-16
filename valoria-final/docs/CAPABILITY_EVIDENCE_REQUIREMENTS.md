# Valoria Capability Evidence Requirements

## Shared professional gates

A professional is not marketplace-ready until:

1. their required profile is complete;
2. the VALU assessment is completed and eligible;
3. their selected capability requirements are satisfied;
4. no active suspension/revocation blocks listing;
5. availability is set when the professional is intended to receive introduction requests.

## Talent

Required before listing:

- complete professional profile;
- VALU completed and eligible;
- active Talent capability;
- current CV uploaded to private storage;
- relevant skills/specialisms;
- availability.

The CV is evidence and is not a public marketplace asset. Organizations should not receive the storage path or direct document URL through normal marketplace discovery.

## Speaker

Required before listing:

- complete professional profile;
- VALU completed and eligible;
- active Speaker capability;
- speaking history record;
- at least one speaking engagement record;
- speaking topics/specialisms;
- availability.

Speaking history describes accumulated experience. Speaking engagements are structured evidence of actual events/programmes delivered.

## Facilitator

Required before listing:

- complete professional profile;
- VALU completed and eligible;
- active Facilitator capability;
- facilitation history record;
- at least one facilitation engagement record;
- facilitation specialisms/programmes;
- availability.

## Design principle

Do not require identical evidence for every professional capability. The marketplace should represent the evidence that is meaningful for the capability being offered.

## Automated readiness

The future eligibility function should evaluate capability-specific gates and return a structured result, for example:

```json
{
  "eligible": true,
  "capability": "speaker",
  "missing": [],
  "reasons": []
}
```

If any hard requirement is missing, the professional remains `NOT_LISTED`; no assessment, profile, or historical record should be deleted.

## Evidence quality vs existence

The initial gate checks whether required evidence exists. Quality scoring, verification levels, experience tiers, and Elite/Established/Emerging classifications should be separate Board-approved rules and must not be invented by the implementation layer.
