import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

// Добавляем интерфейсы для типизации
interface VariantColor {
    id: number;
    price: number;
    sale_price: number | null;
    on_sale: boolean;
    stock: number;
}

interface Product {
    id: number;
    title: string;
    slug: string;
    images?: Array<{ url: string }>;
    variant_colors?: VariantColor[];
}

interface Favorite {
    id: number;
    product: Product;
    user: number;
}

export default factories.createCoreController('api::favorite.favorite', ({ strapi }) => ({
    // Добавить товар в избранное
    async addToFavorites(ctx: Context) {
        const { user } = ctx.state;
        const { productId } = ctx.request.body;

        if (!user) {
            return ctx.unauthorized('User must be logged in');
        }

        if (!productId) {
            return ctx.badRequest('Product ID is required');
        }

        // Проверяем, существует ли уже такая запись
        const existingFavorite = await strapi.db.query('api::favorite.favorite').findOne({
            where: {
                user: user.id,
                product: productId,
            },
        });

        if (existingFavorite) {
            return ctx.badRequest('Product is already in favorites');
        }

        // Создаем новую запись в избранном
        const favorite = await strapi.entityService.create('api::favorite.favorite', {
            data: {
                user: user.id,
                product: productId,
            },
        });

        return ctx.send({
            data: favorite,
        });
    },

    // Удалить товар из избранного
    async removeFromFavorites(ctx: Context) {
        const { user } = ctx.state;
        const { productId } = ctx.params;

        if (!user) {
            return ctx.unauthorized('User must be logged in');
        }

        // Находим запись для удаления
        const favorite = await strapi.db.query('api::favorite.favorite').findOne({
            where: {
                user: user.id,
                product: productId,
            },
        });

        if (!favorite) {
            return ctx.notFound('Favorite not found');
        }

        // Удаляем запись
        await strapi.entityService.delete('api::favorite.favorite', favorite.id);

        return ctx.send({
            message: 'Product removed from favorites',
        });
    },

    // Получить список избранных товаров пользователя
    async getUserFavorites(ctx: Context) {
        const { user } = ctx.state;

        if (!user) {
            return ctx.unauthorized('User must be logged in');
        }

        // Получаем избранные товары с информацией о продуктах
        const favorites = await strapi.db.query('api::favorite.favorite').findMany({
            where: {
                user: user.id,
            },
            populate: {
                product: {
                    select: ['title', 'slug'],
                    populate: {
                        images: {
                            select: ['url'],
                        },
                        variant_colors: {
                            select: ['price', 'sale_price', 'on_sale', 'stock'],
                            limit: 1,
                        },
                    },
                },
            },
        }) as unknown as Favorite[];

        // Преобразуем данные для ответа
        const data = favorites.map((favorite) => {
            const product = favorite.product;
            const variantColor = product.variant_colors?.[0];

            return {
                id: product.id,
                title: product.title,
                slug: product.slug,
                image: product.images?.[0]?.url,
                price: variantColor?.price,
                salePrice: variantColor?.sale_price,
                onSale: variantColor?.on_sale,
                inStock: variantColor?.stock > 0,
            };
        });

        return ctx.send(
            data
        );
    },
})); 