// path: src/api/order/controllers/order.ts
import { factories } from '@strapi/strapi';
import { v4 as uuidv4 } from 'uuid';
import type { Context } from 'koa';

const UID = 'api::order.order';
const ITEM_UID = 'api::order-item.order-item';

// Типы статусов заказа
type OrderStatus = 
  | 'awaiting_payment' 
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'failed';

// Русские названия статусов
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Ожидает оплаты',
  pending: 'В обработке',
  processing: 'Комплектуется',
  paid: 'Оплачен',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменен',
  failed: 'Ошибка'
};

// Русские названия статусов платежей
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает оплаты',
  waiting_for_capture: 'Ожидает подтверждения',
  succeeded: 'Оплачен',
  canceled: 'Отменен',
  'payment.succeeded': 'Оплачен',
  'payment.canceled': 'Отменен',
  'payment.waiting_for_capture': 'Ожидает подтверждения',
  'refund.succeeded': 'Возврат выполнен',
  'expired': 'Истек срок оплаты'
};

// Получить русское название статуса платежа
function getPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || 'Неизвестный статус';
}

// Преобразовать статус платежа Юкассы в статус заказа
function mapYookassaStatusToOrderStatus(yookassaStatus: string): OrderStatus {
  switch (yookassaStatus) {
    case 'succeeded': return 'paid';
    case 'canceled': return 'cancelled';
    case 'pending': return 'awaiting_payment';
    case 'waiting_for_capture': return 'awaiting_payment';
    default: return 'failed';
  }
}

interface OrderData {
  number: string;
  user: number;
  delivery_method: 'delivery' | 'pickup';
  total: number;
  payment_method: 'online' | 'cash';
  payment_session?: string;
  payment_id?: string;
  payment_status?: string;
  payment_created_at?: Date;
  status: OrderStatus;
  delivery_address?: number;
  pickup_point?: number;
  card_number?: string;
  phone: string;
  customer_name: string;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // Создание заказа
  async create(ctx: Context) {
    const { user } = ctx.state;
    const {
      items,
      delivery_method,
      delivery_address_id,
      pickup_point_id,
      payment_method,
      phone,
      customer_name
    } = ctx.request.body;

    if (!user) {
      return ctx.unauthorized('Необходима авторизация');
    }

    // Проверяем наличие необходимых данных
    if (!items?.length || !delivery_method || !payment_method || !phone || !customer_name) {
      return ctx.badRequest('Отсутствуют необходимые данные');
    }

    // Проверяем метод оплаты
    if (!['online', 'cash'].includes(payment_method)) {
      return ctx.badRequest('Неверный метод оплаты');
    }

    // Проверяем метод доставки и соответствующие данные
    if (!['delivery', 'pickup'].includes(delivery_method)) {
      return ctx.badRequest('Неверный метод доставки');
    }

    // Проверяем данные в зависимости от метода доставки
    if (delivery_method === 'delivery' && !delivery_address_id) {
      return ctx.badRequest('Не указан адрес доставки');
    }

    if (delivery_method === 'pickup' && !pickup_point_id) {
      return ctx.badRequest('Не указан пункт выдачи');
    }

    // Валидация номера телефона (простая проверка)
    if (!/^\+?[0-9]{10,15}$/.test(phone)) {
      return ctx.badRequest('Неверный формат номера телефона');
    }

    try {
      // Проверяем существование адреса/пункта выдачи
      if (delivery_method === 'delivery') {
        const address = await strapi.db
          .query('api::address.address')
          .findOne({
            where: {
              id: delivery_address_id,
              user: user.id
            }
          });

        if (!address) {
          return ctx.badRequest('Адрес не найден или не принадлежит пользователю');
        }
      } else {
        const point = await strapi.db
          .query('api::pickup-point.pickup-point')
          .findOne({
            where: { id: pickup_point_id }
          });

        if (!point) {
          return ctx.badRequest('Пункт выдачи не найден');
        }
      }

      // Создаем заказ
      const orderData: OrderData = {
        number: `ORD-${Date.now()}`,
        user: user.id,
        delivery_method,
        total: 0, // Пока 0, обновим после подсчета
        payment_method,
        status: payment_method === 'online' ? 'awaiting_payment' : 'pending',
        phone,
        customer_name,
        payment_created_at: new Date()
      };

      // Добавляем адрес или пункт выдачи в зависимости от метода доставки
      if (delivery_method === 'delivery') {
        orderData.delivery_address = delivery_address_id;
      } else {
        orderData.pickup_point = pickup_point_id;
      }

      // Если оплата онлайн, генерируем сессию
      if (payment_method === 'online') {
        orderData.payment_session = uuidv4();
      }

      const order = await strapi.db.query(UID).create({
        data: orderData
      });

      // Создаем элементы заказа и считаем общую сумму
      let total = 0;
      for (const item of items) {
        const variant = await strapi.db
          .query('api::variant-color.variant-color')
          .findOne({ 
            where: { id: item.variant_id },
            populate: ['product', 'color']
          });

        if (!variant) {
          throw new Error(`Товар с ID ${item.variant_id} не найден`);
        }

        const price = variant.on_sale ? variant.sale_price : variant.price;
        total += price * item.quantity;

        // Создаем элемент заказа с дополнительной информацией
        await strapi.db.query(ITEM_UID).create({
          data: {
            order: order.id,
            variant: item.variant_id,
            quantity: item.quantity,
            price: price,
            product_title: variant.product?.title || 'Неизвестный товар',
            color_name: variant.color?.name || 'Стандартный',
            image_url: variant.image?.url || variant.product?.images?.[0]?.url || null
          }
        });
      }

      // Обновляем общую сумму заказа
      await strapi.db.query(UID).update({
        where: { id: order.id },
        data: { total }
      });

      // Планируем задачу на проверку оплаты через час
      if (payment_method === 'online') {
        await scheduleOrderExpirationCheck(order.id);
      }

      // Возвращаем результат в зависимости от метода оплаты
      return {
        data: {
          order_id: order.id,
          ...(payment_method === 'online' ? {
            payment_url: `${orderData.payment_session}`
          } : {
            status: 'pending',
            status_label: ORDER_STATUS_LABELS.pending,
            message: 'Заказ успешно создан. Оплата при получении.'
          })
        }
      };

    } catch (error) {
      // В случае ошибки отменяем заказ, если он был создан
      if (error.order?.id) {
        await strapi.db.query(UID).update({
          where: { id: error.order.id },
          data: { status: 'failed' }
        });
      }
      return ctx.badRequest(error.message || 'Ошибка при создании заказа');
    }
  },

  // Получение списка заказов пользователя
  async find(ctx: Context) {
    const { user } = ctx.state;

    // Проверяем авторизацию
    if (!user) {
      return ctx.unauthorized('Необходима авторизация');
    }

    // Параметры пагинации
    const { page = 1, pageSize = 10, sort = 'createdAt:desc' } = ctx.query;
    const limit = parseInt(pageSize as string);
    const start = (parseInt(page as string) - 1) * limit;
    
    // Фильтруем только заказы текущего пользователя
    const filters = {
      user: { id: user.id }
    };
    
    // Получаем общее количество заказов пользователя
    const total = await strapi.db.query(UID).count({ where: filters });
    
    // Получаем заказы с пагинацией
    const entities = await strapi.db.query(UID).findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      offset: start,
      limit,
      populate: ['items']
    });
    
    // Форматируем ответ для клиента
    const formattedOrders = entities.map(order => {
      // Форматируем каждый заказ, чтобы вернуть только нужные поля
      return {
        id: order.id,
        number: order.number,
        status: order.status,
        status_label: ORDER_STATUS_LABELS[order.status as OrderStatus] || 'Неизвестный статус',
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        delivery_method: order.delivery_method,
        payment_method: order.payment_method,
        payment_id: order.payment_id,
        payment_status: order.payment_status,
        payment_session: order.payment_session,
        payment_created_at: order.payment_created_at,
        items_count: order.items?.length || 0
      };
    });
    
    // Возвращаем данные с метаинформацией для пагинации
    return {
      data: formattedOrders,
      meta: {
        pagination: {
          page: parseInt(page as string),
          pageSize: limit,
          pageCount: Math.ceil(total / limit),
          total
        }
      }
    };
  },

  // Получение детальной информации о заказе
  async findOne(ctx: Context) {
    const { id } = ctx.params;
    const { user } = ctx.state;

    // Проверяем авторизацию
    if (!user) {
      return ctx.unauthorized('Необходима авторизация');
    }

    // Получаем заказ
    const order = await strapi.db.query(UID).findOne({
      where: {
        id,
        user: { id: user.id }
      },
      populate: {
        items: true,
        delivery_address: true,
        pickup_point: true
      }
    });

    if (!order) {
      return ctx.notFound('Заказ не найден или не принадлежит пользователю');
    }

    // Добавляем русские названия статусов
    return {
      data: {
        ...order,
        status_label: ORDER_STATUS_LABELS[order.status as OrderStatus] || 'Неизвестный статус'
      }
    };
  },

  // Получение статуса заказа
  async getStatus(ctx: Context) {
    const { session } = ctx.params;

    try {
      // Безопасно получаем заказ с базовыми полями, которые точно должны быть
      const order = await strapi.db.query(UID).findOne({
        where: { payment_session: session },
        populate: ['items', 'delivery_address', 'pickup_point'],
      });

      if (!order) {
        return ctx.notFound('Заказ не найден');
      }

      // Получаем все свойства заказа
      const orderData = { ...order };
      
      // Формируем полный ответ с русскими названиями статусов
      return {
        data: {
          order_id: orderData.id,
          status: orderData.status,
          status_label: ORDER_STATUS_LABELS[orderData.status as OrderStatus] || 'Неизвестный статус',
          number: orderData.number,
          total: orderData.total,
          items: orderData.items?.map(item => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price,
            product_title: item.product_title || 'Товар',
            color_name: item.color_name || '-',
            image_url: item.image_url || null
          })) || [],
          delivery_method: orderData.delivery_method,
          payment_method: orderData.payment_method,
          delivery_address: orderData.delivery_address,
          pickup_point: orderData.pickup_point,
          // Добавляем поля, только если они существуют в объекте
          ...(orderData.payment_id ? { payment_id: orderData.payment_id } : {}),
          ...(orderData.payment_status ? { 
            payment_status: orderData.payment_status,
            payment_status_label: getPaymentStatusLabel(orderData.payment_status)
          } : {})
        }
      };
    } catch (error) {
      console.error('Ошибка при получении статуса заказа:', error);
      return ctx.badRequest(`Ошибка при получении статуса заказа: ${error.message}`);
    }
  },

  // Обновление статуса заказа после проверки платежа в Юкассе
  async updatePaymentStatus(ctx: Context) {
    const { orderId, paymentId, paymentStatus } = ctx.request.body;

    if (!orderId || !paymentId || !paymentStatus) {
      return ctx.badRequest('Отсутствуют обязательные параметры');
    }

    const order = await strapi.db.query(UID).findOne({
      where: { id: orderId }
    });

    if (!order) {
      return ctx.notFound('Заказ не найден');
    }

    // Преобразуем статус платежа в статус заказа
    const orderStatus = mapYookassaStatusToOrderStatus(paymentStatus);

    // Обновляем заказ
    await strapi.db.query(UID).update({
      where: { id: orderId },
      data: {
        status: orderStatus,
        payment_id: paymentId,
        payment_status: paymentStatus,
      }
    });

    return {
      data: {
        order_id: orderId,
        status: orderStatus,
        status_label: ORDER_STATUS_LABELS[orderStatus],
        payment_status: paymentStatus
      }
    };
  }
}));

// Планирование проверки оплаты заказа через 1 час
async function scheduleOrderExpirationCheck(orderId: number) {
  setTimeout(async () => {
    try {
      // Получаем заказ
      const order = await strapi.db.query('api::order.order').findOne({
        where: { id: orderId }
      });

      // Если заказ все еще в статусе ожидания оплаты, отменяем его
      if (order && order.status === 'awaiting_payment') {
        await strapi.db.query('api::order.order').update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            payment_status: 'expired'
          }
        });
        
        console.log(`Заказ #${orderId} отменен из-за истечения времени оплаты`);
      }
    } catch (error) {
      console.error(`Ошибка при проверке оплаты заказа #${orderId}:`, error);
    }
  }, 60 * 60 * 1000); // 1 час в миллисекундах
}
