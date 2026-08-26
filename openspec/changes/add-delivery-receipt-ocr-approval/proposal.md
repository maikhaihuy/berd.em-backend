_Priority: medium (real feature gap)_

## Why
Delivery receipt submission with OCR-suggested amounts and manager approval is a core spec'd
workflow ("Tiền ship" tab: "delivery receipt OCR is a suggestion only; manager must approve the
final amount") but no model, module, or endpoint exists for it anywhere in the backend. This
blocks the entire delivery-earnings portion of the employee app spec, and the frontend's
`shipLogs` page (see the frontend's `flesh-out-placeholder-dashboard-pages` proposal).

## What Changes
- Add a `DeliveryReceipt` Prisma model: `employeeId`, `branchId`, optional
  `shiftAssignmentId` link, evidence/image reference, `ocrSuggestedAmount` (nullable — OCR may
  fail), `approvedAmount` (nullable until approved), `status` enum
  (`PENDING_OCR | PENDING_APPROVAL | APPROVED | REJECTED`), `approvedByUserId`, `approvedAt`,
  `rejectionReason`, timestamps.
- Add an employee-facing upload endpoint that stores the receipt and kicks off OCR.
- Add manager-facing approve/reject endpoints setting `approvedAmount`/`status`, guarded by
  branch-scoped permission (reuse the `$managedBranches` pattern from proposal G).
- Add a list/detail endpoint for an employee's own receipts, for the "Tiền ship" screen.

## Capabilities
**New:** `delivery-receipt-management` — employees submit delivery receipts with OCR-suggested
amounts; managers review and approve/reject with a final amount; both amounts are tracked
distinctly.

## Impact
`prisma/schema.prisma` (+ migration), new `src/modules/delivery-receipts/`, an OCR integration
point (provider TBD), `prisma/seed.ts` (new permission rows), `src/modules/casl` (new subject).

**Recommend a `design.md` before `openspec apply`** — the OCR provider choice and
sync-vs-async upload flow are genuine open questions, not implementation details.
