// src/api/cart/controllers/cart.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

const UID = 'api::cart.cart';

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /api/cart
  async find(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    let cart = await strapi.db.query(UID).findOne({
      where: { user: userId },
      populate: ['item', 'item.variant_color'],
    });

    if (!cart) {
      // создаём пустую корзину, а потом сразу же подгружаем связанные компоненты
      const created = await strapi.db.query(UID).create({
        data: { user: userId, item: [] },
      });
      cart = await strapi.db.query(UID).findOne({
        where: { id: created.id },
        populate: ['item', 'item.variant_color'],
      });
    }

    return this.transformResponse(cart);
  },

  // PUT /api/cart
  async update(ctx: Context) {
    // 1) Валидация формата body
    const { item } = ctx.request.body as {
      item?: Array<{ variant_color: { _id: number }; quantity: number }>;
    };

    if (!Array.isArray(item)) {
      return ctx.badRequest('The `item` field must be an array');
    }
    for (const it of item) {
      if (
        typeof it !== 'object' ||
        !it.variant_color ||
        typeof it.variant_color._id !== 'number' ||
        typeof it.quantity !== 'number'
      ) {
        return ctx.badRequest(
          'Each item must be { variant_color: { _id: number }, quantity: number }'
        );
      }
    }

    // 2) Проверяем, что пользователь залогинен
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    // 3) Формируем payload для component-массива:
    //    variant_color — просто число (ID), а не { connect: … }
    const componentData: Array<{ variant_color: number; quantity: number }> =
      item.map((it) => ({
        variant_color: it.variant_color._id,
        quantity: it.quantity,
      }));

    // 4) Ищем существующую корзину
    const existing = await strapi.db.query(UID).findOne({
      where: { user: userId },
    });

    let saved;
    if (existing) {
      // 5a) Обновляем корзину
      saved = await strapi.entityService.update(UID, existing.id, {
        data: { item: componentData },
        populate: ['item', 'item.variant_color'],
      });
    } else {
      // 5b) Или создаём новую
      saved = await strapi.entityService.create(UID, {
        data: { user: userId, item: componentData },
        populate: ['item', 'item.variant_color'],
      });
    }

    // 6) Возвращаем результат клиенту
    return this.transformResponse(saved);
  },
}));
