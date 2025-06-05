import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

export default factories.createCoreController(
    'api::promotion.promotion',
    ({ strapi }) => ({
        // GET /api/promotions
        async find(ctx: Context) {
            try {
                // Получаем параметры пагинации из запроса
                const { page = 1, pageSize = 10 } = ctx.query;
                const start = (Number(page) - 1) * Number(pageSize);
                const limit = Number(pageSize);

                // Временно упрощаем условия для отладки
                const baseQuery = {
                    publishedAt: { $notNull: true },
                };

                // Получаем общее количество акций (без фильтров по датам для проверки)
                const count = await strapi.db.query('api::promotion.promotion').count({
                    where: baseQuery
                });

                console.log('Общее количество акций:', count);

                // Получаем список акций
                const promotions = await strapi.db.query('api::promotion.promotion').findMany({
                    where: baseQuery,
                    orderBy: [
                        { priority: 'desc' },
                        { start_date: 'desc' }
                    ],
                    limit,
                    offset: start,
                    populate: ['preview_image'],
                });

                console.log('Найденные акции:', JSON.stringify(promotions, null, 2));

                // Формируем ответ
                const data = promotions.map(promo => ({
                    id: promo.id,
                    title: promo.title,
                    slug: promo.slug,
                    preview_text: promo.preview_text,
                    preview_image: promo.preview_image?.url,
                    start_date: promo.start_date,
                    end_date: promo.end_date,
                    active: promo.active, // добавляем для отладки
                    publishedAt: promo.publishedAt, // добавляем для отладки
                }));

                // Возвращаем результат с пагинацией
                return {
                    data,
                    meta: {
                        pagination: {
                            page: Number(page),
                            pageSize: Number(pageSize),
                            pageCount: Math.ceil(count / Number(pageSize)),
                            total: count,
                        },
                    },
                };
            } catch (error) {
                console.error('Ошибка при получении акций:', error);
                return ctx.badRequest(`Ошибка при получении акций: ${error.message}`);
            }
        },

        // GET /api/promotions/:id
        async findOne(ctx: Context) {
            try {
                const { id } = ctx.params;
                let query: { id?: number; slug?: string } = { id: Number(id) };

                // Если запрос идет по slug
                if (isNaN(Number(id))) {
                    query = { slug: id };
                }

                // Получаем акцию
                const promotion = await strapi.db.query('api::promotion.promotion').findOne({
                    where: {
                        ...query,
                        active: true,
                        publishedAt: { $notNull: true },
                    },
                    populate: ['preview_image'],
                });

                if (!promotion) {
                    return ctx.notFound('Акция не найдена');
                }

                // Определяем статус акции
                const now = new Date();
                const startDate = new Date(promotion.start_date);
                const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

                let status = 'active';
                if (startDate > now) {
                    status = 'upcoming';
                } else if (endDate && endDate < now) {
                    status = 'expired';
                }

                // Формируем ответ
                const data = {
                    id: promotion.id,
                    title: promotion.title,
                    slug: promotion.slug,
                    preview_text: promotion.preview_text,
                    content: promotion.content,
                    preview_image: promotion.preview_image?.url,
                    start_date: promotion.start_date,
                    end_date: promotion.end_date,
                    status,
                };

                return {
                    data
                };
            } catch (error) {
                console.error('Ошибка при получении акции:', error);
                return ctx.badRequest(`Ошибка при получении акции: ${error.message}`);
            }
        },
    })
); 