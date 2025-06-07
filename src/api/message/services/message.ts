import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::message.message', ({ strapi }) => ({
  // Получить сообщения для пользователя
  async findByUserId(userId: string, options = {}) {
    return await strapi.entityService.findMany('api::message.message', {
      filters: {
        userId: userId
      },
      sort: { createdAt: 'asc' },
      populate: {
        user: {
          fields: ['id', 'username', 'email']
        }
      },
      ...options
    });
  },

  // Создать сообщение
  async createMessage(data: any) {
    return await strapi.entityService.create('api::message.message', {
      data,
      populate: {
        user: {
          fields: ['id', 'username', 'email']
        }
      }
    });
  },

  // Получить последние сообщения для пользователя
  async getRecentMessages(userId: string, limit = 50) {
    return await strapi.entityService.findMany('api::message.message', {
      filters: {
        userId: userId
      },
      sort: { createdAt: 'desc' },
      limit,
      populate: {
        user: {
          fields: ['id', 'username', 'email']
        }
      }
    });
  },

  // Подсчитать непрочитанные сообщения
  async countUnreadMessages(userId: string) {
    return await strapi.entityService.count('api::message.message', {
      filters: {
        userId: userId,
        isFromSupport: true,
        // Можно добавить поле isRead если нужно
      }
    });
  }
})); 