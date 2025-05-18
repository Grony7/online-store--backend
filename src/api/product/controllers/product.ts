// файл: src/api/product/controllers/product.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

const UID = 'api::product.product';
const VARIANT_UID = 'api::variant-color.variant-color';
const SPEC_UID = 'api::specification.specification';
const PRODSPEC_UID = 'api::product-spec.product-spec';
const CAT_UID = 'api::category.category';

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
    const limit   = Math.max(1, Number(pageSize));
    const [rawField, rawOrder] = sort.split(':') as [string, 'asc' | 'desc'];
    const order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc';

    // 4) Базовый where по категории
    const where: any = { category: { id: category.id } };

    // 5) Фильтр по цене (variant_colors.price)
    const { priceMin, priceMax, ...specFilters } = filters;
    if (priceMin || priceMax) {
      where.variant_colors = {
        ...(priceMin && { price: { $gte: Number(priceMin) } }),
        ...(priceMax && { price: { $lte: Number(priceMax) } }),
      };
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
      let parsedVals: (string|number|boolean)[];

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
    const products = await strapi.db
      .query(UID)
      .findMany({
        where,
        select: ['id', 'title', 'slug'],
        populate: {
          images:  { fields: ['url'], limit: 1 },
          variant_colors: {
            fields: ['price', 'sale_price', 'on_sale', 'stock'],
            limit: 1,
          },
        },
        orderBy,
        limit,
        offset: (pageNum - 1) * limit,
      });

    // 10) Формируем ответ
    const data = products.map((p) => {
      const img = p.images?.[0]?.url ?? null;
      const vc = p.variant_colors?.[0] as {
        price: number;
        sale_price: number;
        on_sale: boolean;
        stock: number;
      } | undefined;

      const basePrice = vc
        ? vc.on_sale
          ? vc.sale_price
          : vc.price
        : null;
      const inStock =
        vc?.stock != null ? (vc.stock > 0) : null;

      return {
        id:      p.id,
        title:   p.title,
        slug:    p.slug,
        price:   basePrice,
        inStock: inStock,
        image:   img,
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
          page:      pageNum,
          pageSize:  limit,
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
        variant_colors: { populate: ['color','image'] },
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
    const data = {
      id:            product.id,
      title:         product.title,
      slug:          product.slug,
      description:   product.description,
      images:        product.images.map(img => ({ id: img.id, url: img.url })),
      price:         product.price,
      onSale:        product.on_sale,
      salePrice:     product.sale_price,
      inStock:       product.stock > 0,
      variantColors: product.variant_colors.map(vc => ({
        id:    vc.id,
        color: { id: vc.color.id, name: vc.color.name, hex: vc.color.hex_code },
        image: vc.image?.url || null,
      })),
      specifications: product.product_specs.map(ps => {
        const spec = ps.specification;
        let value: number|string|boolean|null = null;
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
          id:        spec.id,
          name:      spec.name,
          slug:      spec.slug,
          fieldType: spec.fieldType,
          value,
        };
      }),

      reviewCount,
      averageRating,
    };

    return ctx.send({ data });
  },
}));
