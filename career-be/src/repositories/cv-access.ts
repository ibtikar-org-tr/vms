import type { Environment } from '../types/env'
import { createId, nowIso } from '../utils/id'

export type CvAccessStatusRow = 'pending' | 'accepted' | 'rejected' | 'revoked'

export type CvAccessRequestRow = {
  id: string
  owner_membership_number: string
  requester_membership_number: string
  status: CvAccessStatusRow
  message: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
}

export async function getCvAccessBetween(
  env: Environment,
  ownerMembershipNumber: string,
  requesterMembershipNumber: string,
): Promise<CvAccessRequestRow | null> {
  return env.D1_DB.prepare(
    `SELECT * FROM cv_access_requests
     WHERE owner_membership_number = ? AND requester_membership_number = ?
     LIMIT 1`,
  )
    .bind(ownerMembershipNumber, requesterMembershipNumber)
    .first<CvAccessRequestRow>()
}

export async function hasAcceptedCvAccess(
  env: Environment,
  ownerMembershipNumber: string,
  requesterMembershipNumber: string,
): Promise<boolean> {
  if (ownerMembershipNumber === requesterMembershipNumber) return true
  const row = await getCvAccessBetween(env, ownerMembershipNumber, requesterMembershipNumber)
  return row?.status === 'accepted'
}

export async function requestCvAccess(
  env: Environment,
  ownerMembershipNumber: string,
  requesterMembershipNumber: string,
  message?: string | null,
): Promise<CvAccessRequestRow> {
  const existing = await getCvAccessBetween(env, ownerMembershipNumber, requesterMembershipNumber)
  const now = nowIso()
  const note = message?.trim() || null

  if (existing) {
    if (existing.status === 'accepted') return existing
    if (existing.status === 'pending') return existing

    await env.D1_DB.prepare(
      `UPDATE cv_access_requests
       SET status = 'pending', message = ?, updated_at = ?, decided_at = NULL
       WHERE id = ?`,
    )
      .bind(note, now, existing.id)
      .run()

    return {
      ...existing,
      status: 'pending',
      message: note,
      updated_at: now,
      decided_at: null,
    }
  }

  const row: CvAccessRequestRow = {
    id: createId('cva'),
    owner_membership_number: ownerMembershipNumber,
    requester_membership_number: requesterMembershipNumber,
    status: 'pending',
    message: note,
    created_at: now,
    updated_at: now,
    decided_at: null,
  }

  await env.D1_DB.prepare(
    `INSERT INTO cv_access_requests
      (id, owner_membership_number, requester_membership_number, status, message, created_at, updated_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(
      row.id,
      row.owner_membership_number,
      row.requester_membership_number,
      row.status,
      row.message,
      row.created_at,
      row.updated_at,
    )
    .run()

  return row
}

export async function listOwnerAccessRequests(
  env: Environment,
  ownerMembershipNumber: string,
): Promise<CvAccessRequestRow[]> {
  const result = await env.D1_DB.prepare(
    `SELECT * FROM cv_access_requests
     WHERE owner_membership_number = ?
     ORDER BY
       CASE status
         WHEN 'pending' THEN 0
         WHEN 'accepted' THEN 1
         WHEN 'rejected' THEN 2
         ELSE 3
       END,
       updated_at DESC`,
  )
    .bind(ownerMembershipNumber)
    .all<CvAccessRequestRow>()
  return result.results ?? []
}

export async function getOwnerAccessRequest(
  env: Environment,
  ownerMembershipNumber: string,
  requestId: string,
): Promise<CvAccessRequestRow | null> {
  return env.D1_DB.prepare(
    `SELECT * FROM cv_access_requests
     WHERE id = ? AND owner_membership_number = ?
     LIMIT 1`,
  )
    .bind(requestId, ownerMembershipNumber)
    .first<CvAccessRequestRow>()
}

export async function decideCvAccessRequest(
  env: Environment,
  ownerMembershipNumber: string,
  requestId: string,
  status: 'accepted' | 'rejected' | 'revoked',
): Promise<CvAccessRequestRow | null> {
  const current = await getOwnerAccessRequest(env, ownerMembershipNumber, requestId)
  if (!current) return null

  const now = nowIso()
  await env.D1_DB.prepare(
    `UPDATE cv_access_requests
     SET status = ?, updated_at = ?, decided_at = ?
     WHERE id = ? AND owner_membership_number = ?`,
  )
    .bind(status, now, now, requestId, ownerMembershipNumber)
    .run()

  return {
    ...current,
    status,
    updated_at: now,
    decided_at: now,
  }
}
