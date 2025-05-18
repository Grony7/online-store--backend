export default {
  routes: [
    {
      method: 'POST',
      path: '/orders',
      handler: 'order.create',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders',
      handler: 'order.find',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders/:id',
      handler: 'order.findOne',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
