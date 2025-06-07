import { initializeWebSocket } from './utils/websocket';
// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('🚀 BOOTSTRAP: Запуск bootstrap функции...');
    
    // Переопределяем email сервис
    strapi.eventHub.on('strapi::ready', () => {
      console.log('🔧 EMAIL-FIX: Переопределяем email сервис...');
      
      // Получаем оригинальный метод отправки
      const originalSend = strapi.plugins['email'].services.email.send;
      
      // Переопределяем метод send
      strapi.plugins['email'].services.email.send = async function(options) {
        console.log('📧 EMAIL-FIX: Перехватываем отправку email');
        console.log('📧 EMAIL-FIX: Оригинальный from:', options.from);
        
        // Принудительно заменяем отправителя
        const correctFrom = process.env.SMTP_USERNAME;
        if (correctFrom) {
          options.from = correctFrom;
          options.replyTo = correctFrom;
          console.log('📧 EMAIL-FIX: Заменили from на:', correctFrom);
        }
        
        // Вызываем оригинальный метод с исправленными опциями
        return originalSend.call(this, options);
      };
      
      console.log('✅ EMAIL-FIX: Email сервис переопределен!');
    });

    // Инициализация WebSocket - попробуем другой способ
    console.log('🎯 WEBSOCKET-INIT: Настраиваем WebSocket инициализацию...');
    
    // Способ 1: Через event listener на HTTP сервер
    const initWebSocketWhenReady = () => {
      if (strapi.server?.httpServer) {
        console.log('✅ HTTP сервер найден, инициализируем WebSocket');
        initializeWebSocket(strapi);
      } else {
        console.log('⏳ HTTP сервер еще не готов, повторяем через 500ms');
        setTimeout(initWebSocketWhenReady, 500);
      }
    };

    // Запускаем проверку
    setTimeout(initWebSocketWhenReady, 2000);
    
    console.log('✅ BOOTSTRAP: Bootstrap завершен');
  },
}; 