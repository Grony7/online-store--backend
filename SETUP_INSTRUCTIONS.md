# 🚀 Инструкция по запуску онлайн-чата в Strapi 5

## ✅ Что уже сделано

1. ✅ Установлены зависимости: `socket.io`, `jsonwebtoken`, `@types/jsonwebtoken`
2. ✅ Создан Content Type "Message" с полями:
   - `userId` (String)
   - `text` (Text)
   - `isFromSupport` (Boolean)
   - `user` (Relation к пользователю)
3. ✅ Настроен WebSocket сервер в `src/index.ts`
4. ✅ Созданы API endpoints для сообщений
5. ✅ Настроены политики безопасности
6. ✅ Настроен CORS для фронтенда
7. ✅ Создан пример React компонента с красивым UI

## 🔧 Шаги для запуска

### 1. Переменные окружения

Добавьте в ваш `.env` файл:

```env
# Frontend URL для CORS и WebSocket
FRONTEND_URL=http://localhost:3000

# JWT Secret (если не установлен)
JWT_SECRET=your-super-secret-jwt-key-here

# Chat настройки
CHAT_ENABLED=true
```

### 2. Запуск Strapi

```bash
# Если еще не запущен
npm run develop
```

### 3. Настройка ролей в админке Strapi

1. Откройте админку Strapi: http://localhost:1337/admin
2. Перейдите в **Settings** → **Users & Permissions Plugin** → **Roles**
3. Для роли **Authenticated**:
   - Найдите **Message** в списке
   - Включите права: `create`, `find`, `findOne`
4. Создайте роль **Support** (если нужна):
   - Скопируйте права от **Authenticated**
   - Добавьте дополнительные права для **Message**: `update`, `delete`

### 4. Настройка фронтенда

#### Установка зависимостей на фронтенде:

```bash
npm install socket.io-client
```

#### Использование компонента:

```jsx
import React from 'react';
import Chat from './components/Chat';

function App() {
  // Получите токен из вашей системы авторизации
  const userToken = localStorage.getItem('jwt'); // или из Redux/Context
  const userId = localStorage.getItem('userId'); // ID текущего пользователя
  
  return (
    <div className="App">
      <Chat 
        userToken={userToken}
        userId={userId}
        isSupport={false} // true для пользователей поддержки
      />
    </div>
  );
}

export default App;
```

#### Переменные окружения фронтенда:

Создайте `.env` в корне React проекта:

```env
REACT_APP_API_URL=http://localhost:1337
```

## 🧪 Тестирование

### 1. Проверка REST API

```bash
# Получить сообщения пользователя (замените USER_ID и JWT_TOKEN)
curl -X GET "http://localhost:1337/api/messages/user/USER_ID" \
  -H "Authorization: Bearer JWT_TOKEN"

# Создать сообщение
curl -X POST "http://localhost:1337/api/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -d '{
    "data": {
      "text": "Тестовое сообщение",
      "isFromSupport": false
    }
  }'
```

### 2. Проверка WebSocket

Откройте консоль браузера на фронтенде и выполните:

```javascript
// Включить отладку WebSocket
localStorage.debug = 'socket.io-client:socket';

// Перезагрузить страницу и проверить логи подключения
```

## 🔒 Безопасность

### Настроенные политики:

1. **isAuthenticated** - проверка JWT токена
2. **isOwnerOrSupport** - пользователь может читать только свои сообщения

### WebSocket аутентификация:

- Все подключения требуют валидный JWT токен
- Токен передается в `auth.token` при подключении
- Пользователи автоматически присоединяются к своей комнате

## 📡 API Reference

### REST Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/messages/user/:userId` | Получить сообщения пользователя |
| POST | `/api/messages` | Создать сообщение |
| GET | `/api/messages` | Получить все сообщения (админ) |

### WebSocket Events

#### Отправляемые события:

- `join` - присоединиться к комнате (саппорт)
- `message` - отправить сообщение
- `getMessages` - получить историю сообщений

#### Получаемые события:

- `newMessage` - новое сообщение
- `messageHistory` - история сообщений
- `error` - ошибка

## 🐛 Отладка

### Логи сервера:

Strapi выводит логи с префиксами:
- `🚀 CHAT:` - инициализация WebSocket
- `👤 CHAT:` - подключения/отключения
- `💬 CHAT:` - отправка сообщений
- `🔒 CHAT:` - ошибки аутентификации

### Логи клиента:

```javascript
// В консоли браузера
localStorage.debug = 'socket.io-client:socket';
```

### Частые проблемы:

1. **CORS ошибки**: Проверьте `FRONTEND_URL` в `.env`
2. **JWT ошибки**: Убедитесь что токен валидный и не истек
3. **WebSocket не подключается**: Проверьте что Strapi запущен на правильном порту

## 🚀 Продакшн

### Переменные окружения для продакшна:

```env
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
JWT_SECRET=your-super-secure-production-jwt-secret
```

### Настройка прокси (nginx):

```nginx
location /socket.io/ {
    proxy_pass http://localhost:1337;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте логи Strapi в консоли
2. Проверьте Network tab в браузере
3. Убедитесь что все зависимости установлены
4. Проверьте права доступа в админке Strapi

---

**Готово! 🎉** Ваш онлайн-чат готов к использованию! 