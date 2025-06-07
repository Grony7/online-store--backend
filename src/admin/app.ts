import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [
      'ru',
      // 'sk',
      // 'sv',
      // 'th',
      // 'tr',
      // 'uk',
      // 'vi',
      // 'zh-Hans',
      // 'zh',
    ],
    translations: {
      ru: {
        'chat-support.title': 'Чат поддержки',
        'chat-support.subtitle': 'Управление обращениями пользователей',
      },
    },
    theme: {},
    menu: {
      logo: {
        title: 'Online Store',
      },
    },
  },
  bootstrap(app: StrapiApp) {
    console.log(app);
    
    // Добавляем пункт меню для чата поддержки
    app.addMenuLink({
      to: '/settings/chat-support',
      icon: 'discuss',
      intlLabel: {
        id: 'chat-support.menu.title',
        defaultMessage: 'Чат поддержки',
      },
      Component: async () => {
        const component = await import('./pages/ChatSupportSimple');
        return component;
      },
      permissions: [],
    });
  },
};
