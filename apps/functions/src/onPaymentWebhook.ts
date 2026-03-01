import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'

/**
 * HTTP-обработчик вебхука от ЮKassa
 * Обновляет статус подписки тенанта при успешной оплате
 */
export const onPaymentWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  const event = req.body

  // TODO: верификация подписи от ЮKassa (IP whitelist + HMAC)

  if (event.event === 'payment.succeeded') {
    const payment = event.object
    const tenantId = payment.metadata?.tenantId

    if (!tenantId) {
      res.status(400).send('Missing tenantId in metadata')
      return
    }

    await admin.firestore().collection('tenants').doc(tenantId).update({
      'subscription.status': 'active',
      'subscription.renewsAt': new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    })
  }

  res.status(200).send('ok')
})
