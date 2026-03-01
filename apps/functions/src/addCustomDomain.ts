import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'

/**
 * Callable function: добавляет кастомный домен в Vercel проект
 * Вызывается из админки когда владелец вводит свой домен
 */
export const addCustomDomain = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Not authenticated')
  }

  const { domain } = data as { domain: string }
  const uid = context.auth.uid

  // Проверяем что этот uid — владелец тенанта
  const tenantSnap = await admin
    .firestore()
    .collection('tenants')
    .where('ownerId', '==', uid)
    .limit(1)
    .get()

  if (tenantSnap.empty) {
    throw new functions.https.HttpsError('not-found', 'Tenant not found')
  }

  const tenantId = tenantSnap.docs[0].id
  const vercelToken = functions.config().vercel.token
  const vercelProjectId = functions.config().vercel.project_id

  const response = await fetch(
    `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new functions.https.HttpsError('internal', (err as { error?: { message?: string } }).error?.message ?? 'Vercel error')
  }

  await admin.firestore().collection('tenants').doc(tenantId).update({
    customDomain: domain,
  })

  return { success: true }
})
