export default {
  routes: [
    {
      method: 'GET',
      path: '/orders/:orderId/payment',
      handler: 'payment.createPayment',
    },
    {
      method: 'GET',
      path: '/orders/payment/id/:paymentId/status',
      handler: 'payment.checkPaymentStatus',
    },
    {
      method: 'POST',
      path: '/orders/payment/webhook',
      handler: 'payment.handleWebhook',
      config: {
        auth: false
      }
    },
  ],
};
