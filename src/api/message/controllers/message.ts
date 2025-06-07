import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  // Получение всех сообщений для конкретного пользователя
  async findByUserId(ctx) {
    const { userId } = ctx.params;
    
    try {
      // Проверяем авторизацию пользователя
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated to access messages');
      }

      // Проверяем, что пользователь может читать только свои сообщения (или это саппорт)
      const currentUser = ctx.state.user;
      const isSupport = currentUser.role?.type === 'support' || currentUser.role?.name === 'Support';
      
      if (currentUser.id.toString() !== userId && !isSupport) {
        return ctx.forbidden('You can only access your own messages');
      }

      const messages = await strapi.entityService.findMany('api::message.message', {
        filters: {
          userId: userId
        },
        sort: { createdAt: 'asc' },
        populate: {
          user: {
            fields: ['id', 'username', 'email']
          }
        }
      });

      return ctx.send({
        data: messages,
        meta: {
          count: messages.length
        }
      });
    } catch (error) {
      return ctx.badRequest('Error fetching messages', { error: error.message });
    }
  },

  // Создание нового сообщения
  async create(ctx) {
    try {
      // Проверяем авторизацию
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated to send messages');
      }

      const { text, isFromSupport = false } = ctx.request.body.data || ctx.request.body;
      const currentUser = ctx.state.user;

      // Проверяем, что только саппорт может отправлять сообщения от имени саппорта
      const userIsSupport = currentUser.role?.type === 'support' || currentUser.role?.name === 'Support';
      if (isFromSupport && !userIsSupport) {
        return ctx.forbidden('Only support users can send support messages');
      }

      const messageData = {
        userId: currentUser.id.toString(),
        text,
        isFromSupport: userIsSupport ? isFromSupport : false,
        user: currentUser.id
      };

      const message = await strapi.entityService.create('api::message.message', {
        data: messageData,
        populate: {
          user: {
            fields: ['id', 'username', 'email']
          }
        }
      });

      // Отправляем сообщение через WebSocket
      if ((strapi as any).io) {
        (strapi as any).io.to(`user-${currentUser.id}`).emit('newMessage', message);
      }

      return ctx.send({ data: message });
    } catch (error) {
      return ctx.badRequest('Error creating message', { error: error.message });
    }
  },

  // Метод для саппорта: получить все активные чаты
  async getAllChats(ctx) {
    try {
      // Проверяем, что это саппорт
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated');
      }

      const currentUser = ctx.state.user;
      const isSupport = currentUser.role?.type === 'support' || currentUser.role?.name === 'Support';
      
      if (!isSupport) {
        return ctx.forbidden('Only support users can access all chats');
      }

      // Получаем список всех пользователей, которые писали сообщения
      const messages = await strapi.entityService.findMany('api::message.message', {
        fields: ['userId', 'createdAt'],
        populate: {
          user: {
            fields: ['id', 'username', 'email']
          }
        },
        sort: { createdAt: 'desc' }
      });

      // Группируем по пользователям и берем последнее сообщение
      const chatsMap = new Map();
      
      for (const message of messages) {
        if (!chatsMap.has(message.userId)) {
          // Получаем информацию о пользователе
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', message.userId, {
            fields: ['id', 'username', 'email']
          });
          
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
            lastMessageTime: message.createdAt,
            lastMessage: lastMessages[0] || null
          });
        }
      }

      const chats = Array.from(chatsMap.values());

      return ctx.send({
        data: chats,
        meta: {
          count: chats.length
        }
      });
    } catch (error) {
      return ctx.badRequest('Error fetching chats', { error: error.message });
    }
  },

  // Отправить сообщение от саппорта конкретному пользователю
  async sendSupportMessage(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated');
      }

      const currentUser = ctx.state.user;
      const isSupport = currentUser.role?.type === 'support' || currentUser.role?.name === 'Support';
      
      if (!isSupport) {
        return ctx.forbidden('Only support users can send support messages');
      }

      const { targetUserId, text } = ctx.request.body.data || ctx.request.body;

      if (!targetUserId || !text) {
        return ctx.badRequest('targetUserId and text are required');
      }

      const messageData = {
        userId: targetUserId.toString(),
        text,
        isFromSupport: true,
        user: currentUser.id
      };

      const message = await strapi.entityService.create('api::message.message', {
        data: messageData,
        populate: {
          user: {
            fields: ['id', 'username', 'email']
          }
        }
      });

      // Отправляем сообщение через WebSocket в комнату пользователя
      if ((strapi as any).io) {
        (strapi as any).io.to(`user-${targetUserId}`).emit('newMessage', message);
      }

      return ctx.send({ data: message });
    } catch (error) {
      return ctx.badRequest('Error sending support message', { error: error.message });
    }
  }
})); 