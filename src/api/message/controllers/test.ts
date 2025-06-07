export default {
  async testWebSocket(ctx) {
    const { strapi } = ctx;
    
    const status = {
      httpServer: !!strapi.server?.httpServer,
      io: !!(strapi as any).io,
      timestamp: new Date().toISOString()
    };
    
    console.log('🧪 TEST: WebSocket status check:', status);
    
    ctx.body = {
      message: 'WebSocket test endpoint',
      status,
      info: 'Check console for detailed logs'
    };
  },
}; 