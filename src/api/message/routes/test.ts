export default {
  routes: [
    {
      method: 'GET',
      path: '/test-websocket',
      handler: 'test.testWebSocket',
      config: {
        auth: false,
      },
    },
  ],
}; 