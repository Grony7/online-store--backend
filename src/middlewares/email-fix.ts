/**
 * Middleware для исправления отправителя email
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    await next();
    
    // Перехватываем только запросы восстановления пароля
    if (ctx.request.url === '/api/auth/forgot-password' && ctx.request.method === 'POST') {
      console.log('🔧 EMAIL-FIX: Middleware перехватил запрос восстановления пароля');
    }
  };
}; 