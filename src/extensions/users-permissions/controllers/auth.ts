import { factories } from '@strapi/strapi';
import utils from '@strapi/utils';
import crypto from 'crypto';

const { ApplicationError, ValidationError } = utils.errors;

export default factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
  async forgotPassword(ctx) {
    const { email } = ctx.request.body;

    // Проверяем, что email указан
    if (!email) {
      throw new ValidationError('Необходимо указать email');
    }

    // Нормализуем email
    const normalizedEmail = email.toLowerCase();

    try {
      // Ищем пользователя
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email: normalizedEmail },
      });

      if (!user) {
        // Возвращаем успешный ответ даже если пользователь не найден (безопасность)
        return ctx.send({ ok: true });
      }

      // Проверяем, что аккаунт не заблокирован
      if (user.blocked) {
        throw new ApplicationError('Аккаунт заблокирован');
      }

      // Генерируем токен сброса пароля
      const resetPasswordToken = crypto.randomBytes(64).toString('hex');

      // Сохраняем токен в базе данных
      await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { resetPasswordToken },
      });

      // Получаем базовый URL для фронтенда
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?code=${resetPasswordToken}`;

      // Получаем правильный адрес отправителя
      const fromEmail = process.env.SMTP_USERNAME;
      
      if (!fromEmail) {
        throw new ApplicationError('SMTP_USERNAME не настроен в переменных окружения');
      }

      console.log(`📧 Попытка отправки письма с ${fromEmail} на ${user.email}`);

      // Отправляем email с принудительным указанием отправителя
      await strapi.plugins['email'].services.email.send({
        to: user.email,
        from: fromEmail, // явно указываем отправителя
        replyTo: fromEmail, // также указываем reply-to
        subject: 'Восстановление пароля',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Восстановление пароля</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2c5282;">Восстановление пароля</h1>
              
              <p>Здравствуйте, ${user.name || user.username}!</p>
              
              <p>Вы запросили восстановление пароля для вашей учетной записи.</p>
              
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p>Для создания нового пароля перейдите по ссылке:</p>
                <p><a href="${resetUrl}" style="color: #2c5282; text-decoration: none; font-weight: bold;">${resetUrl}</a></p>
              </div>

              <p style="color: #666; font-size: 14px;">
                Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.
                Ссылка действительна в течение 1 часа.
              </p>
              
              <p>С уважением,<br>Команда интернет-магазина</p>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`✅ EMAIL: Письмо восстановления пароля отправлено с ${fromEmail} на ${user.email}`);
      return ctx.send({ ok: true });

    } catch (error) {
      console.error('❌ EMAIL: Ошибка отправки письма восстановления пароля:', error);
      
      // Проверяем тип ошибки SMTP
      if (error.message) {
        if (error.message.includes('user not found') || error.message.includes('Sender address rejected')) {
          console.error('❌ SMTP: Проблема с адресом отправителя. Убедитесь, что SMTP_USERNAME правильно настроен');
          console.error('❌ SMTP: Текущий SMTP_USERNAME:', process.env.SMTP_USERNAME);
        }
      }
      
      throw new ApplicationError('Ошибка отправки письма восстановления пароля');
    }
  },

  async resetPassword(ctx) {
    const { code, password, passwordConfirmation } = ctx.request.body;

    if (!code || !password || !passwordConfirmation) {
      throw new ValidationError('Необходимо указать код, пароль и подтверждение пароля');
    }

    if (password !== passwordConfirmation) {
      throw new ValidationError('Пароли не совпадают');
    }

    // Ищем пользователя по токену
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { resetPasswordToken: code },
    });

    if (!user) {
      throw new ValidationError('Неверный или устаревший код восстановления');
    }

    // Обновляем пароль и очищаем токен
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        password,
        resetPasswordToken: null,
      },
    });

    console.log(`✅ PASSWORD: Пароль успешно изменен для пользователя ${user.email}`);
    
    return ctx.send({
      jwt: strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
      }),
      user: await strapi.entityService.findOne('plugin::users-permissions.user', user.id),
    });
  },
})); 