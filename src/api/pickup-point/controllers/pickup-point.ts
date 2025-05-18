import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

export default factories.createCoreController(
  'api::pickup-point.pickup-point',
  ({ strapi }) => ({
    // GET /pickup-points
    async find(ctx: Context) {
      // Параметры пагинации/сортировки
      const { page = '1', pageSize = '100', sort = 'name:asc' } = ctx.query as Record<string,string>;
      const pageNum = Math.max(1, Number(page));
      const limit   = Math.max(1, Number(pageSize));
      const [field, order] = (sort).split(':') as [string, 'asc'|'desc'];

      // Общее число точек
      const total = await strapi.db
        .query('api::pickup-point.pickup-point')
        .count();

      // Сами точки
      const points = await strapi.db
        .query('api::pickup-point.pickup-point')
        .findMany({
          select: ['id', 'name', 'full_address', 'latitude', 'longitude'],
          orderBy: [{ [field]: order }],
          limit,
          offset: (pageNum - 1) * limit,
        });

      return ctx.send({
        data: points,
        meta: {
          pagination: {
            page:      pageNum,
            pageSize:  limit,
            pageCount: Math.ceil(total / limit),
            total,
          },
        },
      });
    },

    // GET /pickup-points/:id
    async findOne(ctx: Context) {
      const { id } = ctx.params;
      const point = await strapi.db
        .query('api::pickup-point.pickup-point')
        .findOne({
          select: ['id', 'name', 'full_address', 'latitude', 'longitude'],
          where: { id: Number(id) },
        });
      if (!point) {
        return ctx.notFound('Pickup point not found');
      }
      return ctx.send({ data: point });
    },
  })
);
