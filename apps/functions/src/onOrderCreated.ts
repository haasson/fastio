import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import sgMail from '@sendgrid/mail'

/**
 * Триггер: новый документ в /tenants/{tenantId}/orders/{orderId}
 * Отправляет email-уведомление владельцу заведения
 */
export const onOrderCreated = functions.firestore
  .document('tenants/{tenantId}/orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data()
    const { tenantId } = context.params

    const tenantSnap = await admin.firestore().collection('tenants').doc(tenantId).get()
    const tenant = tenantSnap.data()

    if (!tenant?.notifications?.email) return

    sgMail.setApiKey(functions.config().sendgrid.key)

    const itemsList = order.items
      .map((item: { dishName: string; quantity: number; price: number }) =>
        `${item.dishName} x${item.quantity} — ${item.price * item.quantity} ₽`
      )
      .join('\n')

    await sgMail.send({
      to: tenant.notifications.email,
      from: 'noreply@fastfood-saas.ru',
      subject: `Новый заказ #${context.params.orderId.slice(0, 6).toUpperCase()}`,
      text: [
        `Заказ от: ${order.customer.name} (${order.customer.phone})`,
        `Тип: ${order.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз'}`,
        order.address ? `Адрес: ${order.address}` : '',
        ``,
        `Состав:`,
        itemsList,
        ``,
        `Итого: ${order.total} ₽`,
        order.comment ? `Комментарий: ${order.comment}` : '',
      ].filter(Boolean).join('\n'),
    })
  })
