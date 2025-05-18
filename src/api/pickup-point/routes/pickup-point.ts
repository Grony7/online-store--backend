// path: src/api/pickup-point/routes/pickup-point.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/pickup-points',
      handler: 'pickup-point.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/pickup-points/:id',
      handler: 'pickup-point.findOne',
      config: {
        auth: false,
      },
    },
  ],
};
