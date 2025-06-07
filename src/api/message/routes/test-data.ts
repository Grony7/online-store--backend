export default {
  routes: [
    {
      method: 'POST',
      path: '/messages/create-test-data',
      handler: 'test-data.createTestData',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 