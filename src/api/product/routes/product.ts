export default {
  routes: [
    {
      method: 'GET',
      path: '/products/category/:slug',
      handler: 'product.findByCategory',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/products',
      handler: 'product.find',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'product.findFull',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
