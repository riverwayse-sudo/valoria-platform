# ASD-STE100 Engineering Communication Standard

**Reference edition:** ASD-STE100 Issue 9, 15 January 2025  
**Status:** Project writing policy; not a claim of formal compliance.

## Purpose and authority

Use clear, controlled English for technical information. ASD-STE100 is a controlled natural language for technical documentation. It does not replace software design, security, accessibility, testing, or code-quality standards.

Use the current official ASD-STE100 issue for formal compliance. The reference edition for this policy is Issue 9 (15 January 2025). Obtain the official document from https://asd-ste100.org/STE_downloads.html.

Do not copy or republish the standard's protected dictionary or rule text in this repository. This guide is a project policy, not a substitute for Part 1 or Part 2. Describe documents as “STE-aligned” unless a qualified reviewer has checked the complete current official standard.

## Scope

Apply this policy to architecture records, technical specifications, API documentation, implementation plans, deployment and recovery procedures, test plans, test evidence, incident reports, pull requests, code review findings, release notes, user-facing technical instructions, and handover documents.

Do not change source-code identifiers, API fields, database names, third-party names, legal text, or quoted content only to simplify English. Explain specialist terms when the reader needs that explanation.

## Writing rules

1. Write one main fact or instruction in each sentence.
2. Prefer short, direct sentences. Split sentences that contain several actions or conditions.
3. Use active voice when the actor is known.
4. Use present tense for system behavior and imperative form for instructions.
5. Name the actor, action, object, condition, and expected result.
6. Use the same term for the same component or action.
7. Prefer a simple, specific word over an abstract or vague word.
8. Avoid idioms, slang, metaphors, unnecessary abbreviations, and unexplained acronyms.
9. Define acronyms at first use unless they are well-known to the intended reader.
10. Use numbered steps for procedures. Put one action in each step.
11. State warnings before actions that can cause harm, data loss, service interruption, or security exposure.
12. State measurable values with units and define their conditions.
13. Separate confirmed facts, assumptions, risks, and recommendations.
14. Do not remove technical detail that a person needs to complete a task safely.

The official ASD-STE100 rules and dictionary take precedence over this practical baseline.

## Procedure structure

When applicable, include:

- **Purpose:** What the procedure does.
- **Scope:** The system, environment, and people to which it applies.
- **Before you start:** Required access, tools, permissions, backups, and preconditions.
- **Procedure:** Ordered actions, one action per step.
- **Expected result:** The observable result of success.
- **If the result is different:** Safe diagnostic and recovery steps.
- **Verification:** Checks and evidence.
- **Rollback:** How to restore the previous state and any data limits.

Do not give a destructive command without a clear warning, target, and recovery plan.

## Engineering records

Architecture records must state the problem, constraints, decision, alternatives, consequences, and verification method.

Pull requests must state what changed, why it changed, behavior that must remain unchanged, affected systems, risks, tests and results, and outstanding manual actions.

Defect reports must state the observed result, expected result, reproduction steps, impact, evidence, and status. Do not present a suspected cause as a confirmed cause.

Test evidence must identify the environment, action or input, expected result, actual result, and pass/fail status. A successful build alone does not prove that a deployed feature works.

## User-interface language

Use action labels that name the result. Error messages must state what did not work, what the user can do next, and whether user data was saved or changed when that is known. Do not expose stack traces, database details, secrets, internal paths, or security controls in public errors.

## Review and enforcement

Reviewers must check that actions have clear targets and expected results; terms are consistent; conditions and exceptions are explicit; warnings appear before risky actions; and technical facts match the implementation.

Apply this policy to new and materially revised engineering documents. Update older documents when engineers next use or revise them. Do not make a risky mass rewrite. Product, security, accessibility, legal, and technical requirements take priority over stylistic simplification.

For formal compliance, review the complete document against the current official Part 1 rules and Part 2 dictionary. Record the reviewer, edition, document version, findings, and disposition.

## Examples

| Avoid | Prefer |
|---|---|
| “The system will facilitate the processing of the request.” | “The system processes the request.” |
| “In the event that the payment fails, please try again.” | “If the payment fails, try again.” |
| “The configuration needs to be updated by the operator.” | “Update the configuration.” |
| “Ensure that the relevant credentials have been configured.” | “Set the required credentials before you start.” |

## References

- https://www.asd-ste100.org/
- https://asd-ste100.org/STE_downloads.html
- ASD-STE100 Issue 9, 15 January 2025.
