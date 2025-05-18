export default {
  routes: [
    // — создать новый отзыв
    {
      method: 'POST',
      path: '/reviews',
      handler: 'review.create',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    // — обновить свой отзыв
    {
      method: 'PUT',
      path: '/reviews/:id',
      handler: 'review.update',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    // — удалить свой отзыв
    {
      method: 'DELETE',
      path: '/reviews/:id',
      handler: 'review.delete',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    // — получить все отзывы по товару + средний рейтинг и количество
    {
      method: 'GET',
      path: '/products/:id/reviews',
      handler: 'review.findByProduct',
      config: { auth: false },
    },

    {
      method: 'PUT',
      path: '/reviews/by-product/:productId',
      handler: 'review.updateByProduct',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },

    {
      method: 'DELETE',
      path: '/reviews/by-product/:productId',
      handler: 'review.deleteByProduct',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
