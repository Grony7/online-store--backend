// path: src/api/address/routes/address.ts

export default {
  routes: [
    {
      method: 'GET',
      path: '/addresses',
      handler: 'address.find',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/addresses/:id',
      handler: 'address.findOne',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/addresses',
      handler: 'address.create',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/addresses/:id',
      handler: 'address.update',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/addresses/:id',
      handler: 'address.delete',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
