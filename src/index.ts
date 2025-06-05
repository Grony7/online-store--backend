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
  bootstrap({ strapi }) {
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
  },
}; 