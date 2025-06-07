import { prefixPluginTranslations } from '@strapi/strapi/admin';
import PluginIcon from './components/PluginIcon';
import pluginId from './pluginId';

const name = 'chat-support';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: 'Чат поддержки',
      },
      Component: async () => {
        const component = await import('./pages/HomePage');
        return component;
      },
      permissions: [
        // Добавьте необходимые разрешения
      ],
    });

    app.registerPlugin({
      id: pluginId,
      initializer: () => null,
      isReady: false,
      name,
    });
  },

  bootstrap(app: any) {},
  async registerTrads(app: any) {
    const { locales } = app;

    const importedTrads = await Promise.all(
      (locales as string[]).map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => {
            return {
              data: prefixPluginTranslations(data, pluginId),
              locale,
            };
          })
          .catch(() => {
            return {
              data: {},
              locale,
            };
          });
      })
    );

    return Promise.resolve(importedTrads);
  },
}; 