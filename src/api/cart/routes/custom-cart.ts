// /src/api/cart/routes/custom-cart.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/cart',
      handler: 'api::cart.cart.find',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/cart',
      handler: 'api::cart.cart.update',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
