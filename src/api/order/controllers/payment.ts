import { YooCheckout } from '@a2seven/yoo-checkout';
import { factories } from '@strapi/strapi';

const yooKassa = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID || '',
  secretKey: process.env.YOOKASSA_SECRET_KEY || ''
});

// Русские названия статусов платежей
const PAYMENT_STATUS_LABELS = {
  pending: 'Ожидает оплаты',
  waiting_for_capture: 'Ожидает подтверждения',
  succeeded: 'Оплачен',
  canceled: 'Отменен',
  'payment.succeeded': 'Оплачен',
  'payment.canceled': 'Отменен',
  'payment.waiting_for_capture': 'Ожидает подтверждения',
  'refund.succeeded': 'Возврат выполнен'
};

// Соответствие статусов платежей и заказов
const mapYookassaStatusToOrderStatus = {
  succeeded: 'paid',
  canceled: 'cancelled',
  pending: 'awaiting_payment',
  waiting_for_capture: 'awaiting_payment',
  'payment.succeeded': 'paid',
  'payment.canceled': 'cancelled',
  'payment.waiting_for_capture': 'awaiting_payment',
  'refund.succeeded': 'cancelled',
};

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  // Создание платежа
  async createPayment(ctx) {
    try {
      const { orderId } = ctx.params;

      // Получаем заказ
      const order = await strapi.db.query('api::order.order').findOne({
        where: { id: orderId },
        populate: {
          items: true,
          user: true
        }
      });

      if (!order) {
        console.error('Order not found for id', orderId);
        return ctx.notFound('Заказ не найден');
      }

      // Создаем платеж в YooKassa
      try {
        const payment = await yooKassa.createPayment({
          amount: {
            value: order.total.toFixed(2),
            currency: 'RUB'
          },
          capture: true,
          confirmation: {
            type: 'redirect',
            return_url: `${process.env.FRONTEND_URL}/orders`
          },
          description: `Заказ №${order.number}`,
          metadata: {
            orderId: order.id
          }
        });

        // Обновляем заказ с payment_id и payment_status
        await strapi.db.query('api::order.order').update({
          where: { id: order.id },
          data: {
            payment_id: payment.id,
            payment_status: payment.status,
            payment_created_at: new Date(),
            status: 'awaiting_payment'
          }
        });

        return {
          confirmation_url: payment.confirmation.confirmation_url,
          payment_id: payment.id,
          payment_status: payment.status,
          payment_status_label: PAYMENT_STATUS_LABELS[payment.status] || 'Неизвестный статус'
        };
      } catch (error) {
        console.error('YooKassa createPayment error:', error);
        return ctx.badRequest(error.message || error);
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      return ctx.badRequest(error.message || 'Error creating payment');
    }
  },

  // Проверка статуса платежа
  async checkPaymentStatus(ctx) {
    try {
      const { paymentId } = ctx.params;
      console.log('Проверка статуса платежа, paymentId:', paymentId);

      const payment = await yooKassa.getPayment(paymentId);
      console.log('Ответ от YooKassa:', payment);

      const order = await strapi.db.query('api::order.order').findOne({
        where: { payment_id: paymentId }
      });

      if (!order) {
        console.error('Заказ не найден по payment_id:', paymentId);
        return ctx.notFound('Заказ не найден');
      }

      // Определяем статус заказа на основе статуса платежа
      const orderStatus = mapYookassaStatusToOrderStatus[payment.status] || 'failed';

      // Обновляем заказ
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: {
          status: orderStatus,
          payment_status: payment.status
        }
      });

      return {
        order_id: order.id,
        payment_status: payment.status,
        payment_status_label: PAYMENT_STATUS_LABELS[payment.status] || 'Неизвестный статус',
        order_status: orderStatus,
        order_status_label: getOrderStatusLabel(orderStatus)
      };
    } catch (error) {
      console.error('Payment status check error:', error);
      return ctx.badRequest('Ошибка при проверке статуса платежа');
    }
  },

  // Обработка вебхука от YooKassa
  async handleWebhook(ctx) {
    try {
      const { body } = ctx.request;

      // Проверяем подпись вебхука (IP)
      const ip = ctx.request.ip;
      const allowedIPs = ['185.71.76.0/27', '185.71.77.0/27', '77.75.153.0/25', '77.75.156.11', '77.75.156.35'];

      const isAllowedIP = allowedIPs.some(allowed => {
        if (allowed.includes('/')) {
          // Проверка подсети
          const [network, bits] = allowed.split('/');
          const mask = -1 << (32 - Number(bits));
          const networkAddr = network.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
          const ipAddr = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
          return (networkAddr & mask) === (ipAddr & mask);
        }
        return ip === allowed;
      });

      if (!isAllowedIP) {
        return ctx.forbidden('Недопустимый IP-адрес');
      }

      // Получаем данные об оплате
      const event = body.event;
      const payment = body.object;

      console.log('Получен вебхук от YooKassa:', { event, payment });

      // Находим заказ
      const order = await strapi.db.query('api::order.order').findOne({
        where: { payment_id: payment.id }
      });

      if (!order) {
        return ctx.notFound('Заказ не найден');
      }

      // Определяем статус заказа на основе события платежа
      const orderStatus = mapYookassaStatusToOrderStatus[event] || 'failed';

      // Обновляем заказ
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: {
          status: orderStatus,
          payment_status: event
        }
      });

      // Логируем успешное обновление
      console.log(`Заказ #${order.id} обновлен. Статус платежа: ${event}, статус заказа: ${orderStatus}`);

      return ctx.send({ success: true });
    } catch (error) {
      console.error('Webhook handling error:', error);
      return ctx.badRequest('Ошибка при обработке вебхука');
    }
  }
}));

// Вспомогательная функция для получения русского названия статуса заказа
function getOrderStatusLabel(status) {
  const ORDER_STATUS_LABELS = {
    awaiting_payment: 'Ожидает оплаты',
    pending: 'В обработке',
    processing: 'Комплектуется',
    paid: 'Оплачен',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    cancelled: 'Отменен',
    failed: 'Ошибка'
  };

  return ORDER_STATUS_LABELS[status] || 'Неизвестный статус';
}
