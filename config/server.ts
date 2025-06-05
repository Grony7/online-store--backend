export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', `http://localhost:${env.int('PORT', 1337)}`),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Настройки для работы с файлами
  proxy: true,
  // Увеличиваем лимит размера тела запроса для загрузки файлов
  parser: {
    enabled: true,
    multipart: true,
  },
});
