import * as admin from 'firebase-admin'

admin.initializeApp()

export { onOrderCreated } from './onOrderCreated'
export { onPaymentWebhook } from './onPaymentWebhook'
export { addCustomDomain } from './addCustomDomain'
