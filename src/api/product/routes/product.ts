export default {
  routes: [
    {
      method: 'GET',
      path: '/products/search',
      handler: 'product.search',
      config: {
        auth: { required: false },
      },
    },
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
      path: '/products/sale',
      handler: 'product.findOnSale',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/products/brief/:id',
      handler: 'product.getBrief',
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
    }
  ],
};
