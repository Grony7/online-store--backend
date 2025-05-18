// path: src/api/order/controllers/order.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

export default factories.createCoreController(
  'api::order.order',
  ({ strapi }) => ({
    // POST /api/orders
    async create(ctx: Context) {
      const userId = ctx.state.user.id;

      try {
        // 1) Сырой payload из тела
        const {
          items: rawItems,
          payment_method,
          delivery_method,
          pickup_point: rawPickupId,
          address: rawAddressId,
        } = ctx.request.body as {
          items: Array<{ variant_color: number; quantity: number }>;
          payment_method: 'card' | 'sbp' | 'cash' | 'online';
          delivery_method: 'pickup' | 'delivery';
          pickup_point?: number;
          address?: number;
        };

        // 2) Валидация метода доставки
        if (delivery_method === 'pickup' && !rawPickupId) {
          return ctx.badRequest('Для самовывоза нужен pickup_point');
        }
        if (delivery_method === 'delivery' && !rawAddressId) {
          return ctx.badRequest('Для доставки нужен address');
        }

        // 3) Загружаем данные по variant_color, чтобы получить цену
        //    и вычислить total.
        const vcRecords = await Promise.all(
          rawItems.map(async ({ variant_color, quantity }) => {
            const vc = await strapi.db
              .query('api::variant-color.variant-color')
              .findOne({
                where: { id: variant_color },
                populate: ['product']
              });

            if (!vc) {
              throw new Error(`variant_color ${variant_color} не найден`);
            }

            // выбираем актуальную цену (с учётом скидки)
            const unitPrice = vc.on_sale ? vc.sale_price : vc.price;
            return {
              variant_color_id: variant_color,
              product_id: vc.product?.id,
              quantity,
              unit_price: unitPrice,
              line_total: unitPrice * quantity,
            };
          })
        );

        const total = vcRecords.reduce((sum, r) => sum + r.line_total, 0);

        // 4) Создаём заказ
        const order = await strapi.entityService.create('api::order.order', {
          data: {
            user: userId,
            status: 'new',
            payment_method,
            delivery_method,
            total,
            ...(delivery_method === 'pickup'
              ? { pickup_point: rawPickupId }
              : { address: rawAddressId }),
          },
        });

        console.log('Созданный заказ:', JSON.stringify(order, null, 2));

        // 5) Создаём элементы заказа (order-items)
        const orderItems = await Promise.all(
          vcRecords.map(record =>
            strapi.entityService.create('api::order-item.order-item', {
              data: {
                order: order.id,
                variant_color: record.variant_color_id,
                product: record.product_id,
                quantity: record.quantity,
                unit_price: record.unit_price,
              },
            })
          )
        );

        console.log('Созданные элементы заказа:', JSON.stringify(orderItems, null, 2));

        // 6) Получаем заказ с populate
        const entity = await strapi.entityService.findOne('api::order.order', order.id, {
          populate: {
            items: {
              populate: ['variant_color', 'product'],
            },
            pickup_point: delivery_method === 'pickup',
            address: delivery_method === 'delivery',
            user: true,
          },
        });

        if (!entity || !(entity as any).items || (entity as any).items.length === 0) {
          console.error('Заказ создан, но список товаров пуст после populate:', JSON.stringify(entity, null, 2));
        }

        return this.transformResponse({ data: entity });
      } catch (error) {
        console.error('Ошибка при создании заказа:', error);
        return ctx.badRequest(`Ошибка при создании заказа: ${error.message}`);
      }
    },

    async find(ctx: Context) {
      const userId = ctx.state.user.id;

      try {
        // Получаем параметры пагинации из запроса
        const { page = 1, pageSize = 10 } = ctx.query;
        const start = (Number(page) - 1) * Number(pageSize);
        const limit = Number(pageSize);

        // Получаем общее количество заказов пользователя
        const count = await strapi.db.query('api::order.order').count({
          where: { user: { id: userId } },
        });

        // Получаем заказы пользователя с пагинацией
        const orders = await strapi.db.query('api::order.order').findMany({
          where: { user: { id: userId } },
          orderBy: { createdAt: 'desc' },
          limit,
          offset: start,
          populate: ['items.variant_color.product', 'pickup_point', 'address'],
        });

        // Формируем ответ
        const data = orders.map(order => ({
          id: order.id,
          total: order.total,
          status: order.status,
          payment_method: order.payment_method,
          delivery_method: order.delivery_method,
          items_count: order.items?.length || 0,
          location: order.delivery_method === 'pickup'
            ? { id: order.pickup_point?.id, address: order.pickup_point?.full_address }
            : { id: order.address?.id, address: order.address?.full_address },
          createdAt: order.createdAt,
        }));

        // Возвращаем результат с пагинацией
        return this.transformResponse({
          data,
          meta: {
            pagination: {
              page: Number(page),
              pageSize: Number(pageSize),
              pageCount: Math.ceil(count / Number(pageSize)),
              total: count,
            },
          },
        });
      } catch (error) {
        console.error('Ошибка при получении заказов:', error);
        return ctx.badRequest(`Ошибка при получении заказов: ${error.message}`);
      }
    },

    async findOne(ctx: Context) {
      const userId = ctx.state.user.id;
      const { id } = ctx.params;

      try {
        // Ищем заказ по ID и проверяем, что он принадлежит текущему пользователю
        const order = await strapi.db.query('api::order.order').findOne({
          where: { id: Number(id), user: { id: userId } },
          populate: {
            items: {
              populate: {
                variant_color: {
                  populate: ['product']
                }
              }
            },
            pickup_point: true,
            address: true,
          },
        });

        if (!order) {
          return ctx.notFound('Заказ не найден');
        }

        // Формируем ответ
        const data = {
          id: order.id,
          total: order.total,
          status: order.status,
          payment_method: order.payment_method,
          delivery_method: order.delivery_method,
          items: order.items?.map(item => ({
            id: item.id,
            product: item.variant_color?.product,
            variant_color: {
              id: item.variant_color?.id,
              color: item.variant_color?.color,
              price: item.unit_price,
            },
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.quantity * item.unit_price,
          })) || [],
          location: order.delivery_method === 'pickup'
            ? {
              id: order.pickup_point?.id,
              address: order.pickup_point?.full_address,
              name: order.pickup_point?.name,
              working_hours: order.pickup_point?.working_hours,
            }
            : {
              id: order.address?.id,
              address: order.address?.full_address,
              recipient: order.address?.recipient,
              phone: order.address?.phone,
            },
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };

        return this.transformResponse({ data });
      } catch (error) {
        console.error('Ошибка при получении заказа:', error);
        return ctx.badRequest(`Ошибка при получении заказа: ${error.message}`);
      }
    },

  })
);
