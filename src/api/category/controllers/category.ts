// файл: src/api/category/controllers/category.ts
import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

const UID = 'api::category.category';


export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx: Context) {
    // 1) Забираем все категории из БД, подгружая image
    const categories = await strapi.db.query(UID).findMany({
      populate: ['image'],        // без этого image всегда null
      orderBy: { name: 'asc' },   // сортируем по имени
    });

    // 2) Формируем ответ в нужном формате
    const data = categories.map(cat => {
      // Query API кладёт media сразу в cat.image (не в cat.image.data)
      const img = cat.image;
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        image: img
          ? {
            url: img.url,
            name: img.name,
          }
          : null,
      };
    });

    // 3) Отдаём результат
    return ctx.send(data);
  },

  async filters(ctx: Context) {
    const { slug } = ctx.params;

    // 1) Находим категорию
    const category = await strapi.db
      .query('api::category.category')
      .findOne({ where: { slug } });

    if (!category) {
      return ctx.notFound('Category not found');
    }
    const categoryId = category.id;

    // 2) Диапазон цен по variant-color (учитываем скидку)
    const variantColors = await strapi.db
      .query('api::variant-color.variant-color')
      .findMany({
        where: { product: { category: categoryId } },
        select: ['price', 'sale_price', 'on_sale'],
      });
    
    // Собираем все валидные цены
    const prices = variantColors
      .map(vc => {
        // Если есть скидка и sale_price, используем sale_price
        if (vc.on_sale && vc.sale_price !== null && vc.sale_price !== undefined) {
          return vc.sale_price;
        }
        // Иначе используем обычную цену, если она есть
        return vc.price;
      })
      // Фильтруем null, undefined и нулевые цены
      .filter(price => price !== null && price !== undefined && price > 0);
    
    // Вычисляем min/max только если есть валидные цены
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    // 3) Подтягиваем все спецификации, привязанные к этой категории
    const specsDefs = await strapi.db
      .query('api::specification.specification')
      .findMany({
        where: { category: categoryId },
        select: ['id', 'name', 'slug', 'fieldType', 'options'],
      });

    // 4) Смотрим, какие значения по этим спецификациям есть у продуктов
    //    (мы сохранили все «значения» в отдельной коллекции product-spec)
    const prodSpecs = await strapi.db
      .query('api::product-spec.product-spec')
      .findMany({
        where: { product: { category: categoryId } },
        populate: ['specification'],
        select: ['value_string', 'value_number', 'value_boolean'],
      });

    // 5) Группируем реальные значения по slug-у спецификации
    const valuesMap: Record<string, Set<string | number | boolean>> = {};
    for (const ps of prodSpecs) {
      const spec = (ps.specification as any);
      const key = spec.slug;
      if (!valuesMap[key]) valuesMap[key] = new Set();

      let val: string | number | boolean | null = null;
      switch (spec.fieldType) {
        case 'number':
          val = ps.value_number;
          break;
        case 'string':
          val = ps.value_string;
          break;
        case 'boolean':
          val = ps.value_boolean;
          break;
      }

      if (val !== null && val !== undefined) {
        valuesMap[key].add(val);
      }
    }

    // 6) Собираем итоговый массив фильтров-спецификаций
    const specsFilters = specsDefs.map(spec => {
      const raw = valuesMap[spec.slug] || new Set();
      const arr = Array.from(raw);

      // для числовых сортируем по возрастанию
      if (spec.fieldType === 'number') {
        // @ts-ignore
        arr.sort((a, b) => (a as number) - (b as number));
      } else {
        // иначе — лексикографически
        arr.sort();
      }

      return {
        id: spec.id,
        name: spec.name,
        slug: spec.slug,
        fieldType: spec.fieldType,
        options: spec.options,      // пригодится, если вы хотите показывать выбор из предзаданных опций
        values: arr,                // вот массив реальных значений
      };
    }).filter(f => f.values.length > 0);

    // 7) Отдаём всё вместе
    ctx.send({

        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
        },
        filters: {
          priceRange: { min: minPrice, max: maxPrice },
          specifications: specsFilters,
        },

    });
  },
}));
