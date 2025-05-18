export default {
  routes: [
    {
      method: 'GET',
      path: '/categories',
      handler: 'category.find',   // <-- тот самый find, что мы переопределили
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/categories/:slug/filters',
      handler: 'category.filters',
      config: { auth: false },
    },
  ],
};
