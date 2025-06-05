/**
 * user-profile router
 */

import { factories } from '@strapi/strapi';

export default {
  routes: [
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'user-profile.me',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/update',
      handler: 'user-profile.updateProfile',
      config: {
        auth: { public: false },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
