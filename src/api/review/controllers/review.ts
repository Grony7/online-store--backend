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

    // 5) возвращаем только минимально необходимую информацию
    const result: any = await strapi.entityService.findOne(UID, review.id, {
      populate: {
        media: {
          fields: ['id', 'url', 'formats']
        }
      }
    });

    const mediaFiles = result.media || [];

    // Возвращаем только необходимые данные
    return ctx.send({
      data: {
        id: review.id,
        rating,
        comment,
        media: mediaFiles.map(media => ({
          id: media.id,
          url: media.url,
          thumbnail: media.formats?.thumbnail?.url || media.url,
          type: isMediaVideo(media.url) ? 'video' : 'image'
        }))
      }
    });
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
    await strapi.db.query(UID).update({
      where: { id },
      data: {
        media: {
          set: finalIds.map((i) => ({ id: i })),
        },
      },
    });

    // 7) Получаем и возвращаем только необходимые медиафайлы
    const result: any = await strapi.entityService.findOne(UID, id, {
      populate: {
        media: {
          fields: ['id', 'url', 'formats']
        }
      }
    });

    const mediaFiles = result.media || [];

    // Возвращаем упрощенный ответ
    return ctx.send({
      data: {
        id,
        rating: rating !== undefined ? rating : existing.rating,
        comment: comment !== undefined ? comment : existing.comment,
        media: mediaFiles.map(media => ({
          id: media.id,
          url: media.url,
          thumbnail: media.formats?.thumbnail?.url || media.url,
          type: isMediaVideo(media.url) ? 'video' : 'image'
        }))
      }
    });
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

    // Получаем параметры пагинации
    const {
      page = '1',
      pageSize = '10',
      sort = 'createdAt:desc'
    } = ctx.query as Record<string, string>;

    const pageNum = Math.max(1, Number(page));
    const limit = Math.max(1, Math.min(Number(pageSize), 50)); // Ограничиваем максимум 50 отзывов за раз
    const offset = (pageNum - 1) * limit;

    // Настраиваем сортировку
    const [sortField, sortOrder] = (sort || 'createdAt:desc').split(':');
    const orderBy = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };

    // 1) Сначала получаем общую статистику по отзывам (без пагинации)
    const allReviews = await strapi.db.query(UID).findMany({
      where: { product: productId },
      select: ['rating'],
    });

    const totalCount = allReviews.length;
    const avgRating = totalCount > 0
      ? Number((allReviews.reduce((sum, r: any) => sum + r.rating, 0) / totalCount).toFixed(1))
      : 0;
    
    // 2) Затем получаем только нужные отзывы с пагинацией и ограниченными данными
    const reviews = await strapi.db.query(UID).findMany({
      where: { product: productId },
      select: ['rating', 'comment', 'createdAt', 'updatedAt'],
      populate: {
        user: {
          select: ['id', 'username', 'email'],
        },
        media: {
          select: ['url', 'width', 'height', 'formats'],
        },
      },
      orderBy,
      limit,
      offset,
    });

    // 3) Получаем профили пользователей с аватарками
    const userIds = reviews.map(review => review.user.id);
    const userProfiles = userIds.length > 0 ? await strapi.db.query('api::user-profile.user-profile').findMany({
      where: {
        user: { id: { $in: userIds } }
      },
      populate: {
        avatar: {
          select: ['url', 'formats'],
        },
        user: {
          select: ['id'],
        },
      },
    }) : [];

    // Создаем мапу профилей по user id
    const profileMap = new Map();
    userProfiles.forEach(profile => {
      profileMap.set(profile.user.id, profile);
    });

    // 4) Форматируем ответ с оптимизацией данных и разделением на фото и видео
    const formattedReviews = reviews.map(review => {
      // Определяем тип медиафайла по расширению
      const mediaWithType = review.media ? review.media.map(media => {
        const url = media.url;
        const fileExtension = url.split('.').pop()?.toLowerCase() || '';
        const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(fileExtension);
        
        return {
          url: url,
          thumbnail: media.formats?.thumbnail?.url || media.url,
          type: isVideo ? 'video' : 'image',
          // Добавляем информацию о размере, если доступна
          width: media.width || null,
          height: media.height || null,
        };
      }) : [];
      
      const userProfile = profileMap.get(review.user.id);
      
      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        user: {
          id: review.user.id,
          username: review.user.username,
          avatar: userProfile?.avatar ? {
            url: userProfile.avatar.url,
          } : null,
        },
        media: mediaWithType,
      };
    });

    return ctx.send({
        reviews: formattedReviews,
        stats: {
          averageRating: avgRating,
          reviewsCount: totalCount,
        },
        pagination: {
          page: pageNum,
          pageSize: limit,
          pageCount: Math.ceil(totalCount / limit),
          total: totalCount,
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
    await strapi.db.query(UID).update({
      where: { id: existing.id },
      data: {
        media: {
          set: finalIds.map((i) => ({ id: i })),
        },
      },
    });

    // 8) Получаем и возвращаем только необходимые медиафайлы
    const result: any = await strapi.entityService.findOne(UID, existing.id, {
      populate: {
        media: {
          fields: ['id', 'url', 'formats']
        }
      }
    });

    const mediaFiles = result.media || [];

    // Возвращаем упрощенный ответ
    return ctx.send({
      data: {
        id: existing.id,
        rating: rating !== undefined ? rating : existing.rating,
        comment: comment !== undefined ? comment : existing.comment,
        media: mediaFiles.map(media => ({
          id: media.id,
          url: media.url,
          thumbnail: media.formats?.thumbnail?.url || media.url,
          type: isMediaVideo(media.url) ? 'video' : 'image'
        }))
      }
    });
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

// Вспомогательная функция для определения типа медиафайла
function isMediaVideo(url: string): boolean {
  const fileExtension = url.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(fileExtension);
}
