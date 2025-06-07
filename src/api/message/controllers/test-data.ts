export default {
  async createTestData(ctx) {
    try {
      // Создаем тестового пользователя если его нет
      let testUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: 'test@example.com' }
      });

      if (!testUser) {
        testUser = await strapi.entityService.create('plugin::users-permissions.user', {
          data: {
            username: 'test_user',
            name: 'Test User',
            email: 'test@example.com',
            password: 'testpassword123',
            confirmed: true,
            provider: 'local'
          }
        });
      }

      // Создаем второго тестового пользователя
      let testUser2 = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: 'user2@example.com' }
      });

      if (!testUser2) {
        testUser2 = await strapi.entityService.create('plugin::users-permissions.user', {
          data: {
            username: 'another_user',
            name: 'Another User',
            email: 'user2@example.com', 
            password: 'testpassword123',
            confirmed: true,
            provider: 'local'
          }
        });
      }

      // Создаем тестовые сообщения
      const testMessages = [
        {
          userId: testUser.id.toString(),
          text: 'Привет! У меня вопрос по заказу',
          isFromSupport: false
        },
        {
          userId: testUser.id.toString(),
          text: 'Здравствуйте! Чем могу помочь?',
          isFromSupport: true
        },
        {
          userId: testUser.id.toString(),
          text: 'Я заказал товар неделю назад, но его до сих пор нет',
          isFromSupport: false
        },
        {
          userId: testUser2.id.toString(),
          text: 'Спасибо за помощь!',
          isFromSupport: false
        },
        {
          userId: testUser2.id.toString(),
          text: 'Пожалуйста! Обращайтесь если будут вопросы',
          isFromSupport: true
        }
      ];

      // Удаляем старые тестовые сообщения
      await strapi.db.query('api::message.message').deleteMany({
        where: {
          userId: {
            $in: [testUser.id.toString(), testUser2.id.toString()]
          }
        }
      });

      // Создаем новые сообщения
      const createdMessages = [];
      for (const msgData of testMessages) {
        const message = await strapi.entityService.create('api::message.message', {
          data: msgData
        });
        createdMessages.push(message);
      }

      return ctx.send({
        data: {
          users: [testUser, testUser2],
          messages: createdMessages
        },
        meta: {
          success: true,
          message: 'Тестовые данные созданы успешно'
        }
      });
    } catch (error) {
      return ctx.badRequest('Error creating test data', { error: error.message });
    }
  }
}; 