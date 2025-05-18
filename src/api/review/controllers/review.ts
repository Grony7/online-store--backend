// path: src/api/review/controllers/review.ts
import type { Context } from 'koa';
import { factories } from '@strapi/strapi';

const UID = 'api::review.review';

export default factories.createCoreController(UID, ({ strapi }) => ({
  // POST /api/reviews
  async create(ctx: Context) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // 1) разбираем body и файлы
    const data = ctx.request.body as Record<string, any>;
    const files = (ctx.request.files as Record<string, any>) || {};

    const productId = Number(data.product);
    const rating    = Number(data.rating);
    const comment   = data.comment || '';

    if (!productId || isNaN(rating)) {
      return ctx.badRequest('Provide a valid product id and numeric rating');
    }

    // ────────────────────────────────────────
    // 2) проверяем, нет ли уже отзыва от этого user на этот product
    const existing = await strapi.db.query(UID).findOne({
      where: {
        user:    { id: user.id },
        product: { id: productId },
      },
    });
    if (existing) {
      return ctx.badRequest('Вы уже оставили отзыв для этого товара');
    }
    // ────────────────────────────────────────

    // 3) создаём Review без media
    const review = await strapi.entityService.create(UID, {
      data: {
        user:    user.id,
        product: productId,
        rating,
        comment,
      },
      populate: ['user','product'],
    });

    // 4) прикрепляем медиа, если пришли файлы
    if (files.media) {
      await strapi
        .plugin('upload')
        .service('upload')
        .upload({
          data: {
            ref:   UID,
            refId: review.id,
            field: 'media',
          },
          files: files.media,
        });
    }

    // 5) возвращаем уже с media
    const result = await strapi.entityService.findOne(UID, review.id, {
      populate: ['user','product','media'],
    });
    return this.transformResponse(result);
  },

  // PUT /reviews/:id
  async update(ctx: Context) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    if (isNaN(id)) return ctx.badRequest('Invalid review id');

    // 1) Проверяем авторство
    const existing = await strapi.db.query(UID).findOne({
      where: { id },
      populate: ['user','media'],
    });
    if (!existing)      return ctx.notFound();
    if (existing.user.id !== user.id) return ctx.forbidden();

    // 2) Парсим body + файлы
    const parts = ctx.request.body.data
      ? JSON.parse(ctx.request.body.data as string)
      : (ctx.request.body as Record<string, any>);
    const files = (ctx.request.files as any)?.media;

    const rating  = parts.rating  != null ? Number(parts.rating) : undefined;
    const comment = parts.comment != null ? parts.comment      : undefined;
    const keepIds = Array.isArray(parts.media)
      ? parts.media.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
      : [];

    // 3) Обновляем текстовые поля сразу
    await strapi.entityService.update(UID, id, {
      data: { rating, comment },
    });

    // 4) Если есть новые файлы — загружаем их
    let newFiles: Array<{ id: number }> = [];
    if (files) {
      newFiles = await strapi
        .plugin('upload')
        .service('upload')
        .upload({
          data: {
            ref:   UID,
            refId: id,
            field: 'media',
          },
          files,
        });
    }

    // 5) Собираем окончательный список media ID
    const finalIds = Array.from(new Set([
      ...keepIds,
      ...newFiles.map((f) => f.id),
    ]));

    // 6) «Привязываем» ровно этот набор, старые отвязываются автоматически
    const updated = await strapi.db.query(UID).update({
      where: { id },
      data: {
        media: {
          set: finalIds.map((i) => ({ id: i })),
        },
      },
      populate: ['user','product','media'],
    });

    return this.transformResponse(updated);
  },

  // DELETE /reviews/:id
  async delete(ctx: Context) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const id = Number(ctx.params.id);
    if (isNaN(id)) {
      return ctx.badRequest('Invalid review id');
    }

    const existing = await strapi.db.query(UID).findOne({
      where: { id },
      populate: ['user'],
    });
    if (!existing) {
      return ctx.notFound('Review not found');
    }
    if (existing.user.id !== user.id) {
      return ctx.forbidden('You can only delete your own review');
    }

    const deleted = await strapi.entityService.delete(UID, id);
    return this.transformResponse(deleted);
  },

  // GET /products/:id/reviews
  async findByProduct(ctx: Context) {
    const productId = Number(ctx.params.id);
    if (isNaN(productId)) {
      return ctx.badRequest('Invalid product id');
    }

    // снова Query API, чтобы не мучиться с типами filters
    const reviews = await strapi.db.query(UID).findMany({
      where: { product: productId },
      populate: ['user', 'media'],
    });

    const count = reviews.length;
    const avg =
      count > 0
        ? reviews.reduce((sum, r: any) => sum + r.rating, 0) / count
        : 0;

    return ctx.send({
      data: {
        reviews,
        stats: {
          averageRating: Number(avg.toFixed(2)),
          reviewsCount: count,
        },
      },
    });
  },

  async updateByProduct(ctx: Context) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // 1) парсим productId из URL
    const productId = Number(ctx.params.productId);
    if (isNaN(productId)) {
      return ctx.badRequest('Invalid productId');
    }

    // 2) ищем существующий отзыв этого user на этот product
    const existing = await strapi.db.query(UID).findOne({
      where: {
        user:    { id: user.id },
        product: { id: productId },
      },
      populate: ['user', 'product', 'media'],
    });
    if (!existing) {
      return ctx.notFound('Review not found');
    }

    // 3) разбираем поля и файлы
    const parts = ctx.request.body.data
      ? JSON.parse(ctx.request.body.data as string)
      : (ctx.request.body as Record<string, any>);
    const files = (ctx.request.files as any)?.media;

    const rating  = parts.rating  != null ? Number(parts.rating) : undefined;
    const comment = parts.comment != null ? parts.comment      : undefined;
    const keepIds = Array.isArray(parts.media)
      ? parts.media.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
      : [];

    // 4) обновляем текстовые поля
    await strapi.entityService.update(UID, existing.id, {
      data: { rating, comment },
    });

    // 5) загружаем новые файлы, если есть
    let newFiles: Array<{ id: number }> = [];
    if (files) {
      newFiles = await strapi
        .plugin('upload')
        .service('upload')
        .upload({
          data: { ref: UID, refId: existing.id, field: 'media' },
          files,
        });
    }

    // 6) составляем финальный список media-ID
    const finalIds = Array.from(new Set([
      ...keepIds,
      ...newFiles.map((f) => f.id),
    ]));

    // 7) применяем replace media через Query API
    const updated = await strapi.db.query(UID).update({
      where: { id: existing.id },
      data: {
        media: {
          set: finalIds.map((i) => ({ id: i })),
        },
      },
      populate: ['user', 'product', 'media'],
    });

    return this.transformResponse(updated);
  },

  async deleteByProduct(ctx: Context) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const productId = Number(ctx.params.productId);
    if (isNaN(productId)) {
      return ctx.badRequest('Invalid productId');
    }

    // 1) Найти отзыв этого user на этот product
    const existing = await strapi.db.query(UID).findOne({
      where: {
        user:    { id: user.id },
        product: { id: productId },
      },
      populate: ['media'],
    });

    if (!existing) {
      return ctx.notFound('Review not found');
    }

    // 2) (опционально) удалить прикреплённые медиа
    if (existing.media?.length) {
      await Promise.all(
        existing.media.map((f: any) =>
          strapi.plugin('upload').service('upload').remove({ id: f.id })
        )
      );
    }

    // 3) удалить сам отзыв
    const deleted = await strapi.entityService.delete(UID, existing.id);

    return this.transformResponse(deleted);
  },
}));
