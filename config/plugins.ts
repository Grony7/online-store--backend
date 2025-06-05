export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['name']
      },
      jwt: {
        expiresIn: '7d',
      },
      // Настройка email для восстановления пароля
      ratelimit: {
        interval: 60000, // время в миллисекундах
        max: 5, // максимум попыток за интервал
      },
    }
  },
  email: {
    config: {
      // ВАЖНО: именно такой провайдер ставим – @strapi/provider-email-nodemailer
      provider: "@strapi/provider-email-nodemailer",

      // Настройки для Яндекс SMTP
      providerOptions: {
        host: env("SMTP_HOST", "smtp.yandex.ru"),
        port: env("SMTP_PORT", 465),
        secure: true, // SSL для порта 465
        auth: {
          user: env("SMTP_USERNAME"), // ваш email на Яндексе
          pass: env("SMTP_PASSWORD"), // пароль приложения
        },
        // Дополнительные опции для Яндекс
        tls: {
          rejectUnauthorized: false,
        },
        // Принудительные настройки отправителя
        defaults: {
          from: env("SMTP_USERNAME"),
          replyTo: env("SMTP_USERNAME"),
        },
        debug: true, // включаем отладку для диагностики
        logger: true,
      },

      // Адреса, которые Strapi будет подставлять по умолчанию
      settings: {
        defaultFrom: env("SMTP_USERNAME"), // используем тот же email что и для аутентификации
        defaultReplyTo: env("SMTP_USERNAME"), // используем тот же email что и для аутентификации
        // Дополнительные настройки для правильной работы
        testAddress: env("SMTP_USERNAME"),
        // Принудительно переопределяем отправителя
        from: env("SMTP_USERNAME"),
      },
    },
  },
});
