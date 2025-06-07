export default {
  routes: [
    {
      method: 'GET',
      path: '/messages',
      handler: 'message.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/messages/:id',
      handler: 'message.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/messages',
      handler: 'message.create',
      config: {
        policies: ['global::isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/messages/:id',
      handler: 'message.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/messages/:id',
      handler: 'message.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Кастомный маршрут для получения сообщений пользователя
    {
      method: 'GET',
      path: '/messages/user/:userId',
      handler: 'message.findByUserId',
      config: {
        policies: ['global::isAuthenticated', 'global::isOwnerOrSupport'],
        middlewares: [],
      },
    },
    // Получить все чаты (только для саппорта)
    {
      method: 'GET',
      path: '/messages/chats/all',
      handler: 'message.getAllChats',
      config: {
        policies: ['global::isAuthenticated'],
        middlewares: [],
      },
    },
    // Отправить сообщение от саппорта
    {
      method: 'POST',
      path: '/messages/support/send',
      handler: 'message.sendSupportMessage',
      config: {
        policies: ['global::isAuthenticated'],
        middlewares: [],
      },
    },
  ],
}; 