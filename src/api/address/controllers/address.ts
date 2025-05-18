// src/api/address/controllers/address.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

interface AddressPayload {
  full_address: string;
  latitude: number;
  longitude: number;
}

export default factories.createCoreController('api::address.address', ({ strapi }) => ({
  // GET /api/addresses
  async find(ctx: Context) {
    const userId = ctx.state.user.id;

    // Получаем только нужные поля из БД
    const entries = await strapi.db
      .query('api::address.address')
      .findMany({
        where: { user: userId },
        select: ['id', 'full_address', 'latitude', 'longitude'],
        orderBy: { createdAt: 'desc' },
      });

    // Возвращаем чистый ответ
    return ctx.send({
      data: entries.map(e => ({
        id: e.id,
        full_address: e.full_address,
        latitude: e.latitude,
        longitude: e.longitude,
      })),
    });
  },

  // POST /api/addresses
  async create(ctx: Context) {
    const userId = ctx.state.user.id;
    // явно типизируем входящий JSON
    const { full_address, latitude, longitude } = ctx.request.body as AddressPayload;

    const entry = await strapi.entityService.create('api::address.address', {
      data: {
        full_address,
        latitude,
        longitude,
        user: userId,         // кладём связку «адрес ↔ пользователь»
      },
    });

    return this.transformResponse(entry);
  },

  // PUT /api/addresses/:id
  async update(ctx: Context) {
    const userId = ctx.state.user.id;
    const { id } = ctx.params as { id: string };

    // подтягиваем старую запись, чтобы проверить владельца
    const existing = (await strapi.entityService.findOne(
      'api::address.address',
      id,
      { populate: ['user'] },
    )) as any;

    if (!existing || existing.user.id !== userId) {
      return ctx.forbidden('You can only update your own address');
    }

    // снова явно типизируем payload
    const { full_address, latitude, longitude } = ctx.request.body as AddressPayload;

    const updated = await strapi.entityService.update('api::address.address', id, {
      data: { full_address, latitude, longitude },
    });

    return this.transformResponse(updated);
  },

  // DELETE /api/addresses/:id
  async delete(ctx: Context) {
    const userId = ctx.state.user.id;
    const { id } = ctx.params as { id: string };

    const existing = (await strapi.entityService.findOne(
      'api::address.address',
      id,
      { populate: ['user'] },
    )) as any;

    if (!existing || existing.user.id !== userId) {
      return ctx.forbidden('You can only delete your own address');
    }

    const deleted = await strapi.entityService.delete('api::address.address', id);
    return this.transformResponse(deleted);
  },
}));
