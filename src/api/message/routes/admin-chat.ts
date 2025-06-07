export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/chats/all',
      handler: 'admin-chat.getAllChats',
      config: {
        auth: false, // Используем кастомную проверку внутри контроллера
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET', 
      path: '/admin/chats/:userId/history',
      handler: 'admin-chat.getChatHistory',
      config: {
        auth: false, // Используем кастомную проверку внутри контроллера
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin/chats/send',
      handler: 'admin-chat.sendMessage',
      config: {
        auth: false, // Используем кастомную проверку внутри контроллера
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 