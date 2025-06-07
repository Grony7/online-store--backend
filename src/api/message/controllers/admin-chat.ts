export default {
  // Получение всех активных чатов для админки
  async getAllChats(ctx) {
    try {
      // В продакшене здесь должна быть проверка админа

      // Получаем все сообщения
      const messages = await strapi.entityService.findMany('api::message.message', {
        fields: ['userId', 'text', 'isFromSupport', 'createdAt'],
        sort: { createdAt: 'desc' },
        limit: 1000
      });

      if (messages.length === 0) {
        return ctx.send({
          data: [],
          meta: { count: 0 }
        });
      }

      // Группируем по пользователям
      const chatsMap = new Map();
      
      for (const message of messages) {
        if (!chatsMap.has(message.userId)) {
          try {
            // Получаем информацию о пользователе
            const user = await strapi.entityService.findOne('plugin::users-permissions.user', message.userId, {
              fields: ['id', 'username', 'email', 'createdAt']
            });
            
            if (user) {
              // Получаем последнее сообщение для этого пользователя
              const lastMessages = await strapi.entityService.findMany('api::message.message', {
                filters: { userId: message.userId },
                sort: { createdAt: 'desc' },
                limit: 1,
                fields: ['text', 'isFromSupport', 'createdAt']
              });

              chatsMap.set(message.userId, {
                userId: message.userId,
                user: user,
                lastMessageTime: lastMessages[0]?.createdAt || message.createdAt,
                lastMessage: lastMessages[0] || null
              });
            }
                      } catch (error) {
              // Игнорируем ошибки получения пользователя
            }
        }
      }

      const chats = Array.from(chatsMap.values());

      return ctx.send({
        data: chats,
        meta: { count: chats.length }
      });
    } catch (error) {
      return ctx.badRequest('Error fetching chats', { error: error.message });
    }
  },

  // Получение истории сообщений конкретного пользователя для админки
  async getChatHistory(ctx) {
    try {
      const { userId } = ctx.params;
      
      const messages = await strapi.entityService.findMany('api::message.message', {
        filters: { userId: userId },
        sort: { createdAt: 'asc' },
        fields: ['id', 'text', 'isFromSupport', 'createdAt', 'userId']
      });

      return ctx.send({
        data: messages,
        meta: { count: messages.length }
      });
    } catch (error) {
      return ctx.badRequest('Error fetching chat history', { error: error.message });
    }
  },

  // Отправка сообщения от админа
  async sendMessage(ctx) {
    try {
      const { targetUserId, text } = ctx.request.body.data;
      
      if (!targetUserId || !text) {
        return ctx.badRequest('Target user ID and message text are required');
      }

      // Создаем сообщение от поддержки
      const message = await strapi.entityService.create('api::message.message', {
        data: {
          userId: targetUserId,
          text: text.trim(),
          isFromSupport: true,
        }
      });

      // Отправляем через WebSocket (если есть)
      try {
        const io = (strapi as any).io;
        if (io) {
          io.to(`user_${targetUserId}`).emit('newMessage', {
            ...message,
            isFromSupport: true
          });
        }
      } catch (socketError) {
        // WebSocket недоступен
      }

      return ctx.send({
        data: message,
        meta: { success: true }
      });
    } catch (error) {
      return ctx.badRequest('Error sending message', { error: error.message });
    }
  }
}; 