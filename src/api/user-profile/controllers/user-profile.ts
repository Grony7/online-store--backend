/**
 * user-profile controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::user-profile.user-profile', ({ strapi }) => ({
  // Получить профиль текущего пользователя
  async me(ctx) {
    console.log('🟢 PROFILE: Запрос профиля пользователя');
    
    const authUserId = ctx.state.user?.id;
    
    if (!authUserId) {
      console.log('❌ PROFILE: Пользователь не авторизован');
      return ctx.unauthorized();
    }
    
    try {
      // Получаем базовые данные пользователя из users-permissions
      const authUser = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        authUserId
      );
      
      if (!authUser) {
        console.log('❌ PROFILE: Пользователь не найден в users-permissions');
        return ctx.notFound('Пользователь не найден');
      }
      
      // Ищем связанный профиль в нашей таблице
      const userProfile = await strapi.entityService.findMany(
        'api::user-profile.user-profile',
        {
          filters: {
            user: authUserId
          },
          populate: {
            avatar: true
          }
        }
      );
      
      console.log('✅ PROFILE: Профиль найден:', !!userProfile?.[0]);
      
      const profile = userProfile?.[0] as any;
      
      // Формируем ответ
      const response = {
        id: authUser.id,
        username: authUser.username,
        email: authUser.email,
        name: authUser.name,
        provider: authUser.provider,
        confirmed: authUser.confirmed,
        blocked: authUser.blocked,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
        // Добавляем поля из профиля
        phone: profile?.phone || null,
        birthdate: profile?.birthdate || null,
        gender: profile?.gender || null,
        avatarUrl: null
      };
      
      // Добавляем аватарку, если есть
      if (profile?.avatar) {
        console.log('✅ PROFILE: Добавляем аватарку:', profile.avatar.url);
        
        const serverUrl = strapi.config.get('server.url', 'http://localhost:1337');
        
        response.avatarUrl = profile.avatar.url.startsWith('http') 
          ? profile.avatar.url 
          : `${serverUrl}${profile.avatar.url}`;
      } else {
        console.log('⚠️ PROFILE: У пользователя нет аватарки');
      }
      
      return ctx.send(response);
      
    } catch (error) {
      console.error('❌ PROFILE: Ошибка при получении профиля:', error);
      return ctx.badRequest('Ошибка при получении профиля пользователя');
    }
  },

  // Обновить профиль пользователя
  async updateProfile(ctx) {
    console.log('🟡 PROFILE: Обновление профиля пользователя');
    
    const authUserId = ctx.state.user?.id;
    
    if (!authUserId) {
      console.log('❌ PROFILE: Пользователь не авторизован');
      return ctx.unauthorized();
    }
    
    try {
      const { files } = ctx.request;
      const body = ctx.request.body;
      
      console.log('🔍 PROFILE: Обновляем поля:', Object.keys(body || {}));
      console.log('🔍 PROFILE: Файлы в запросе:', !!files?.avatar);
      
      // Ищем существующий профиль
      const existingProfile = await strapi.entityService.findMany(
        'api::user-profile.user-profile',
        {
          filters: {
            user: authUserId
          },
          populate: {
            avatar: true
          }
        }
      );
      
      let profileId = existingProfile?.[0]?.id;
      const currentProfile = existingProfile?.[0] as any;
      
      // Подготавливаем данные для обновления
      const updateData: any = {
        user: authUserId
      };
      
      // Добавляем простые поля (согласно схеме: phone, birthdate, gender)
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.birthdate !== undefined) updateData.birthdate = body.birthdate;
      if (body.gender !== undefined) updateData.gender = body.gender;
      
      // Обрабатываем аватарку
      if (files?.avatar) {
        console.log('📤 PROFILE: Загружаем новую аватарку...');
        
        // Удаляем старую аватарку, если есть
        if (currentProfile?.avatar) {
          console.log('🗑️ PROFILE: Удаляем старую аватарку');
          try {
            await strapi.plugins.upload.services.upload.remove(currentProfile.avatar);
          } catch (removeError: any) {
            console.log('⚠️ PROFILE: Ошибка при удалении старой аватарки:', removeError.message);
          }
        }
        
        // Загружаем новую аватарку
        const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
          data: {},
          files: files.avatar,
        });
        
        console.log('✅ PROFILE: Аватарка загружена:', uploadedFiles[0]?.id);
        updateData.avatar = uploadedFiles[0]?.id;
      }
      
      let updatedProfile: any;
      
      if (profileId) {
        // Обновляем существующий профиль
        console.log('✏️ PROFILE: Обновляем существующий профиль:', profileId);
        updatedProfile = await strapi.entityService.update(
          'api::user-profile.user-profile',
          profileId,
          {
            data: updateData,
            populate: {
              avatar: true
            }
          }
        );
      } else {
        // Создаем новый профиль
        console.log('➕ PROFILE: Создаем новый профиль');
        updatedProfile = await strapi.entityService.create(
          'api::user-profile.user-profile',
          {
            data: updateData,
            populate: {
              avatar: true
            }
          }
        );
      }
      
      console.log('✅ PROFILE: Профиль обновлен');
      
      // Получаем базовые данные пользователя
      const authUser = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        authUserId
      );
      
      // Формируем ответ
      const response = {
        id: authUser.id,
        username: authUser.username,
        email: authUser.email,
        name: authUser.name,
        provider: authUser.provider,
        confirmed: authUser.confirmed,
        blocked: authUser.blocked,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
        phone: updatedProfile.phone || null,
        birthdate: updatedProfile.birthdate || null,
        gender: updatedProfile.gender || null,
        avatarUrl: null as string | null
      };
      
      // Добавляем аватарку
      if (updatedProfile.avatar) {
        const serverUrl = strapi.config.get('server.url', 'http://localhost:1337');
        
        response.avatarUrl = updatedProfile.avatar.url.startsWith('http') 
          ? updatedProfile.avatar.url 
          : `${serverUrl}${updatedProfile.avatar.url}`;
        
        console.log('✅ PROFILE: Аватарка добавлена в ответ:', response.avatarUrl);
      }
      
      return ctx.send(response);
      
    } catch (error: any) {
      console.error('❌ PROFILE: Ошибка при обновлении профиля:', error);
      return ctx.badRequest('Ошибка при обновлении профиля: ' + error.message);
    }
  }
}));
