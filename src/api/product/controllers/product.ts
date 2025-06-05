// файл: src/api/product/controllers/product.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

const UID = 'api::product.product';
const VARIANT_UID = 'api::variant-color.variant-color';
const SPEC_UID = 'api::specification.specification';
const PRODSPEC_UID = 'api::product-spec.product-spec';
const CAT_UID = 'api::category.category';

/**
 * Функция для разделения массива медиафайлов на изображения и видео
 */
function separateMediaFiles(mediaFiles: any[]): { imageUrls: string[], videoUrls: string[] } {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];

  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  mediaFiles.forEach(media => {
    if (!media) return;

    // Получаем URL в зависимости от формата
    let url = '';
    if (typeof media === 'string') {
      url = media;
    } else if (media.url) {
      url = media.url;
    } else if (media.formats && media.formats.thumbnail && media.formats.thumbnail.url) {
      url = media.formats.thumbnail.url;
    } else if (media.data && media.data.attributes) {
      if (media.data.attributes.url) {
        url = media.data.attributes.url;
      } else if (media.data.attributes.formats && media.data.attributes.formats.thumbnail) {
        url = media.data.attributes.formats.thumbnail.url;
      }
    }

    // Если URL получен, добавляем в соответствующий массив
    if (url) {
      const isVideo = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
      if (isVideo) {
        videoUrls.push(url);
      } else {
        imageUrls.push(url);
      }
    }
  });

  return { imageUrls, videoUrls };
}

// Добавляем интерфейсы для типизации
interface VariantColor {
  id: number;
  price: number;
  sale_price: number;
  on_sale: boolean;
  stock: number;
  product?: {
    id: number;
  };
}

interface Product {
  id: number;
  title: string;
  slug: string;
  images?: Array<{ url: string }>;
  videos?: Array<{ url: string }>;
  variant_colors?: VariantColor[];
  category?: {
    name: string;
    slug: string;
  };
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  // для списка товаров
  async find(ctx) {
    // вместо super.find используем entityService с указанием полей
    const products = await strapi.entityService.findMany('api::product.product', {
      fields: ['title', 'slug'],             // передаем только title и slug
      populate: {
        images: {                             // подтягиваем только URL картинок
          fields: ['url']
        },
        specifications: true,                 // подтягиваем весь объект спецификаций
        variant_colors: {                     // подтягиваем варианты
          fields: ['price', 'sale_price', 'on_sale', 'stock'],
          populate: {
            color: { fields: ['name', 'hex_code'] },
            images: { fields: ['url'] }
          }
        }
      },
      sort: { createdAt: 'desc' },            // например, сортировка по дате
    });

    return this.transformResponse(products);
  },

  // поиск по товарам
  async search(ctx) {
    try {
      // Получаем параметры запроса
      const { q, page = 1, pageSize = 10 } = ctx.query;

      if (!q) {
        return ctx.badRequest('Параметр поиска q обязателен');
      }

      const searchTerm = String(q);
      const limit = Number(pageSize);
      const offset = (Number(page) - 1) * limit;

      // Формируем условие поиска
      const where = {
        $or: [
          { title: { $containsi: searchTerm } },
          { description: { $containsi: searchTerm } }
        ]
      };

      // Получаем общее количество найденных товаров
      const count = await strapi.db.query(UID).count({ where });

      // Получаем товары
      const products = await strapi.db.query(UID).findMany({
        where,
        select: ['id', 'title', 'slug'],
        populate: {
          images: {
            fields: ['url'],
            limit: 1
          },
          variant_colors: {
            fields: ['price', 'sale_price', 'on_sale', 'stock'],
            limit: 1,
            populate: {
              color: { fields: ['name', 'hex_code'] }
            }
          },
          category: {
            fields: ['name', 'slug']
          }
        },
        limit,
        offset,
        orderBy: { title: 'asc' }
      });

      // Формируем ответ
      const data = products.map(p => {
        const imageUrl = p.images?.[0]?.url || null;
        const vc = p.variant_colors?.[0];

        const price = vc
          ? vc.on_sale && vc.sale_price
            ? vc.sale_price
            : vc.price
          : null;

        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          image: imageUrl,
          price,
          category: p.category
            ? {
              name: p.category.name,
              slug: p.category.slug
            }
            : null,
          in_stock: vc ? vc.stock > 0 : false
        };
      });

      return {
        data,
        meta: {
          pagination: {
            page: Number(page),
            pageSize: limit,
            pageCount: Math.ceil(count / limit),
            total: count,
          },
        }
      };
    } catch (error) {
      console.error('Ошибка при поиске товаров:', error);
      return ctx.badRequest(`Ошибка при поиске товаров: ${error.message}`);
    }
  },

  async findByCategory(ctx: Context) {
    // 1) Параметры запроса
    const { slug } = ctx.params as { slug: string };
    const {
      page = '1',
      pageSize = '12',
      sort = 'createdAt:desc',
      ...filters
    } = ctx.query as Record<string, string>;

    // 2) Получаем категорию
    const category = await strapi.db
      .query(CAT_UID)
      .findOne({ where: { slug }, select: ['id', 'name', 'slug'] });

    if (!category) {
      return ctx.notFound('Category not found');
    }

    // 3) Пагинация и сортировка
    const pageNum = Math.max(1, Number(page));
    const limit = Math.max(1, Number(pageSize));
    const [rawField, rawOrder] = sort.split(':') as [string, 'asc' | 'desc'];
    const order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc';

    // 4) Базовый where по категории
    const where: any = { category: { id: category.id } };

    // 5) Фильтр по цене (variant_colors.price)
    const { priceMin, priceMax, ...specFilters } = filters;
    if (priceMin || priceMax) {
      // Новый подход - ищем продукты, у которых ХОТЯ БЫ ОДИН вариант попадает в диапазон цен
      const priceConditions = [];

      // Если указана минимальная цена - добавляем условие
      if (priceMin) {
        priceConditions.push({
          variant_colors: {
            // Проверяем обычную цену, если нет скидки
            $or: [
              {
                $and: [
                  { on_sale: false },
                  { price: { $gte: Number(priceMin) } }
                ]
              },
              // Или скидочную цену, если есть скидка
              {
                $and: [
                  { on_sale: true },
                  { sale_price: { $gte: Number(priceMin) } }
                ]
              }
            ]
          }
        });
      }

      // Если указана максимальная цена - добавляем условие
      if (priceMax) {
        priceConditions.push({
          variant_colors: {
            // Проверяем обычную цену, если нет скидки
            $or: [
              {
                $and: [
                  { on_sale: false },
                  { price: { $lte: Number(priceMax) } }
                ]
              },
              // Или скидочную цену, если есть скидка
              {
                $and: [
                  { on_sale: true },
                  { sale_price: { $lte: Number(priceMax) } }
                ]
              }
            ]
          }
        });
      }

      // Если есть условия - добавляем их в общий where
      if (priceConditions.length > 0) {
        where.$and = where.$and || [];
        where.$and.push(...priceConditions);
      }
    } else if (where.variant_colors) {
      // Удаляем старое условие по variant_colors, если оно было
      delete where.variant_colors;
    }

    // 6) Фильтры по спецификациям
    const specsDefs = await strapi.db
      .query(SPEC_UID)
      .findMany({
        where: { category: category.id },
        select: ['slug', 'fieldType'],
      });

    const andSpecs: any[] = [];

    for (const [key, rawVal] of Object.entries(specFilters)) {
      const def = specsDefs.find((s) => s.slug === key);
      if (!def) continue;

      // приводим rawVal к массиву строк
      const vals = Array.isArray(rawVal)
        ? rawVal
        : String(rawVal).split(',');

      // по типу поля выбираем атрибут в product-spec-value
      let attr: 'value_number' | 'value_string' | 'value_boolean';
      let parsedVals: (string | number | boolean)[];

      switch (def.fieldType) {
        case 'number':
          attr = 'value_number';
          parsedVals = vals.map((v) => Number(v));
          break;
        case 'boolean':
          attr = 'value_boolean';
          parsedVals = vals.map((v) => v === 'true');
          break;
        default:
          attr = 'value_string';
          parsedVals = vals;
      }

      // если одно значение — можно оставить просто равенство,
      // но сработает и $in для единичного элемента
      andSpecs.push({
        product_specs: {
          specification: { slug: key },
          [attr]: { $in: parsedVals },
        },
      });
    }

    if (andSpecs.length) {
      where.$and = andSpecs;
    }

    // 7) Вычисляем общее количество
    const total = await strapi.db
      .query(UID)
      .count({ where });

    // 8) Готовим orderBy с учётом сортировки по цене
    let orderBy: any[];
    if (rawField === 'price' || rawField === 'salePrice') {
      const vcField = rawField === 'price' ? 'price' : 'sale_price';
      orderBy = [{ variant_colors: { [vcField]: order } }];
    } else {
      orderBy = [{ [rawField]: order }];
    }

    // 9) Запрашиваем товары
    console.log('Query parameters:', {
      where,
      orderBy,
      limit,
      offset: (pageNum - 1) * limit
    });

    const products = await strapi.db
      .query(UID)
      .findMany({
        where,
        select: ['id', 'title', 'slug'],
        populate: {
          // Используем полное заполнение для изображений вместо fields: ['url']
          images: true,
          variant_colors: {
            fields: ['id', 'price', 'sale_price', 'on_sale', 'stock'],
          },
        },
        orderBy,
        limit,
        offset: (pageNum - 1) * limit,
      });

    // 10) Формируем ответ
    const data = products.map((p) => {
      console.log('Product images:', p.id, p.title, p.images);

      // Проверяем, есть ли изображения и если нет, то логируем это
      if (!p.images || p.images.length === 0) {
        console.warn(`Товар ${p.id} (${p.title}) не имеет изображений`);
      }

      // Разделяем изображения и видео
      const { imageUrls, videoUrls } = separateMediaFiles(p.images || []);

      // Получаем URL первого изображения
      const mainImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

      // Найдем вариант с минимальной ценой для отображения
      let bestPriceVariant = null;
      if (p.variant_colors && p.variant_colors.length > 0) {
        bestPriceVariant = p.variant_colors.reduce((best, current) => {
          const bestPrice = best.on_sale ? best.sale_price : best.price;
          const currentPrice = current.on_sale ? current.sale_price : current.price;
          return currentPrice < bestPrice ? current : best;
        }, p.variant_colors[0]);
      }

      // Проверяем, есть ли хотя бы один вариант в наличии
      const anyInStock = p.variant_colors?.some(vc => vc.stock > 0) ?? false;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: bestPriceVariant ? bestPriceVariant.price : null,
        sale_price: bestPriceVariant && bestPriceVariant.on_sale ? bestPriceVariant.sale_price : null,
        discount_percent: bestPriceVariant && bestPriceVariant.on_sale && bestPriceVariant.price && bestPriceVariant.sale_price
          ? Math.round(((bestPriceVariant.price - bestPriceVariant.sale_price) / bestPriceVariant.price) * 100)
          : null,
        inStock: anyInStock,
        image: mainImageUrl,
        variantColorIds: p.variant_colors ? p.variant_colors.map(vc => vc.id) : []
      };
    });

    return ctx.send({
      data: {
        category: {
          slug: category.slug,
          name: category.name,
        },
        products: data,
      },
      meta: {
        pagination: {
          page: pageNum,
          pageSize: limit,
          pageCount: Math.ceil(total / limit),
          total,
        },
      },
    });
  },

  async findFull(ctx: Context) {
    const { id } = ctx.params;

    // 1) Подтянем сам продукт (без отзывов)
    const product = await strapi.db.query(UID).findOne({
      where: { id: Number(id) },
      populate: {
        images: true,
        variant_colors: { populate: ['color', 'images'] },
        product_specs: { populate: ['specification'] },
      },
    });

    if (!product) {
      return ctx.notFound('Product not found');
    }

    // 2) Посчитаем статистику по отзывам
    const allReviews = await strapi.db.query('api::review.review').findMany({
      where: { product: Number(id) },
      select: ['rating'],
    });
    const reviewCount = allReviews.length;
    const averageRating = reviewCount > 0
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : null;

    // 3) Собираем ответ
    // Разделяем изображения и видео для продукта
    const { imageUrls: productImageUrls, videoUrls: productVideoUrls } =
      separateMediaFiles(product.images || []);

    const data = {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      images: productImageUrls.map(url => ({ url })),
      videos: productVideoUrls.map(url => ({ url })),
      variantColors: product.variant_colors.map(vc => {
        // Разделяем изображения и видео для варианта цвета
        const { imageUrls: vcImageUrls, videoUrls: vcVideoUrls } =
          separateMediaFiles(vc.images || []);

        return {
        id: vc.id,
        color: { id: vc.color.id, name: vc.color.name, hex: vc.color.hex_code },
          image: vcImageUrls[0] || null,
          images: vcImageUrls,
          videos: vcVideoUrls,
        price: vc.price,
        sale_price: vc.sale_price,
        on_sale: vc.on_sale,
        stock: vc.stock
        };
      }),
      specifications: product.product_specs.map(ps => {
        const spec = ps.specification;
        let value: number | string | boolean | null = null;
        switch (spec.fieldType) {
          case 'number':
            value = ps.value_number;
            break;
          case 'string':
            value = ps.value_string;
            break;
          case 'boolean':
            value = ps.value_boolean;
            break;
          default:
            value = null;
        }
        return {
          id: spec.id,
          name: spec.name,
          slug: spec.slug,
          fieldType: spec.fieldType,
          value,
        };
      }),
      reviewCount,
      averageRating,
    };

    return ctx.send({ data });
  },

  // GET /products/sale
  async findOnSale(ctx: Context) {
    try {
      // 1) Параметры запроса
      const {
        page = '1',
        pageSize = '12',
        sort = 'discount:desc'
      } = ctx.query as Record<string, string>;

      const pageNum = Math.max(1, Number(page));
      const limit = Math.max(1, Number(pageSize));

      // 2) Получаем категорию смартфонов
      const category = await strapi.db
        .query(CAT_UID)
        .findOne({
          where: { slug: 'smartphones' },
          select: ['id', 'name', 'slug']
        });

      if (!category) {
        return ctx.notFound('Category smartphones not found');
      }

      // 3) Получаем товары со скидкой
      const products = await strapi.db
        .query(UID)
        .findMany({
          where: {
            category: category.id,
            variant_colors: {
              on_sale: true
            }
          },
          select: ['id', 'title', 'slug'],
          populate: {
            // Используем полное заполнение для изображений
            images: true,
            variant_colors: {
              where: {
                on_sale: true
              },
              select: ['id', 'price', 'sale_price', 'on_sale', 'stock']
            }
          },
          limit,
          offset: (pageNum - 1) * limit
        });

      // 4) Получаем общее количество товаров со скидкой
      const total = await strapi.db
        .query(UID)
        .count({
          where: {
            category: category.id,
            variant_colors: {
              on_sale: true
            }
          }
        });

      // 5) Форматируем данные
      const data = products.map(product => {
        console.log('Sale product images:', product.id, product.title, product.images);

        // Проверяем, есть ли изображения и если нет, то логируем это
        if (!product.images || product.images.length === 0) {
          console.warn(`Товар со скидкой ${product.id} (${product.title}) не имеет изображений`);
        }

        // Разделяем изображения и видео
        const { imageUrls, videoUrls } = separateMediaFiles(product.images || []);

        // Получаем URL первого изображения
        const mainImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

        // Находим вариант с максимальной скидкой
        let bestVariant = null;
        let maxDiscount = 0;

        if (product.variant_colors?.length) {
          for (const variant of product.variant_colors) {
            if (variant.price && variant.sale_price) {
              const discount = ((variant.price - variant.sale_price) / variant.price) * 100;
              if (discount > maxDiscount) {
                maxDiscount = discount;
                bestVariant = variant;
              }
            }
          }
        }

        return {
          id: product.id,
          title: product.title,
          slug: product.slug,
          image: mainImageUrl,
          images: imageUrls,
          videos: videoUrls,
          price: bestVariant?.price || null,
          sale_price: bestVariant?.sale_price || null,
          discount_percent: Math.round(maxDiscount),
          inStock: bestVariant ? bestVariant.stock > 0 : false,
          variantColorIds: product.variant_colors ? product.variant_colors.map(vc => vc.id) : []
        };
      });

      // 6) Сортировка
      if (sort === 'discount:desc') {
        data.sort((a, b) => b.discount_percent - a.discount_percent);
      } else if (sort === 'price:asc') {
        data.sort((a, b) => (a.sale_price || 0) - (b.sale_price || 0));
      } else if (sort === 'price:desc') {
        data.sort((a, b) => (b.sale_price || 0) - (a.sale_price || 0));
      }

      return {
        data,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: limit,
            pageCount: Math.ceil(total / limit),
            total
          }
        }
      };

    } catch (error) {
      console.error('Ошибка при получении товаров со скидкой:', error);
      return ctx.badRequest(`Ошибка при получении товаров со скидкой: ${error.message}`);
    }
  },

  // Получение краткой информации по товару и цвету
  async getBrief(ctx: Context) {
    try {
      const productId = Number(ctx.params.id);
      const colorVariantId = ctx.query.colorId ? Number(ctx.query.colorId) : null;

      if (isNaN(productId)) {
        return ctx.badRequest('Некорректный ID товара');
      }

      // Получаем товар с базовой информацией
      const product = await strapi.db.query(UID).findOne({
        where: { id: productId },
        select: ['id', 'title'],
        populate: {
          images: {
            fields: ['url'],
            limit: 1
          }
        }
      });

      if (!product) {
        return ctx.notFound('Товар не найден');
      }

      let colorVariant = null;

      // Если передан colorId, ищем конкретную вариацию
      if (colorVariantId && !isNaN(colorVariantId)) {
        colorVariant = await strapi.db.query(VARIANT_UID).findOne({
          where: {
            id: colorVariantId,
            product: { id: productId }
          },
          select: ['id', 'price', 'sale_price', 'on_sale', 'stock'],
          populate: {
            color: {
              fields: ['name', 'hex_code']
            },
            images: {
              fields: ['url'],
              limit: 1
            }
          }
        });
      }

      // Если вариация не найдена или colorId не передан, берем первую доступную
      if (!colorVariant) {
        colorVariant = await strapi.db.query(VARIANT_UID).findOne({
          where: {
            product: { id: productId }
          },
          select: ['id', 'price', 'sale_price', 'on_sale', 'stock'],
          populate: {
            color: {
              fields: ['name', 'hex_code']
            },
            images: {
              fields: ['url'],
              limit: 1
            }
          },
          orderBy: { id: 'asc' } // Берем первый по ID
        });
      }

      if (!colorVariant) {
        return ctx.notFound('У товара нет доступных вариаций цвета');
      }

      // Определяем картинку: приоритет у вариации цвета, иначе общая картинка товара
      const image = colorVariant.images?.[0]?.url || product.images?.[0]?.url || null;

      // Формируем ответ
      const briefInfo = {
        id: product.id,
        title: product.title,
        price: colorVariant.price,
        sale_price: colorVariant.sale_price,
        on_sale: colorVariant.on_sale,
        image: image,
        quantity: colorVariant.stock,
        color: {
          name: colorVariant.color.name,
          hex_code: colorVariant.color.hex_code
        }
      };

      return ctx.send({ ...briefInfo });

    } catch (error) {
      console.error('Ошибка при получении краткой информации о товаре:', error);
      return ctx.badRequest(`Ошибка при получении краткой информации: ${error.message}`);
    }
  },
}));
