import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

export const initializeWebSocket = (strapi: any) => {
  console.log('🚀 WEBSOCKET: Инициализация WebSocket модуля...');
  
  try {
    if (!strapi.server?.httpServer) {
      console.error('💥 WEBSOCKET: HTTP сервер не найден');
      return null;
    }

    console.log('✅ WEBSOCKET: HTTP сервер найден, создаем Socket.IO...');

    const io = new SocketIOServer(strapi.server.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    console.log('✅ WEBSOCKET: Socket.IO сервер создан');

    // Middleware для аутентификации WebSocket
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Верификация JWT токена
        const jwtSecret = process.env.JWT_SECRET || strapi.config.get('plugin.users-permissions.jwt.secret');
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        
        // Получаем пользователя из базы данных
        const user = await strapi.entityService.findOne('plugin::users-permissions.user', decoded.id, {
          populate: {
            role: true
          }
        });

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        (socket as any).userId = user.id;
        (socket as any).user = user;
        next();
      } catch (error) {
        console.error('🔒 WEBSOCKET: Authentication error:', error);
        next(new Error('Authentication error'));
      }
    });

    // Обработка подключений
    io.on('connection', async (socket) => {
      console.log(`👤 WEBSOCKET: User ${(socket as any).userId} connected`);

      // Присоединяем пользователя к его персональной комнате
      socket.join(`user-${(socket as any).userId}`);
      
      // Отправляем тестовое сообщение для проверки
      socket.emit('test', { message: 'WebSocket соединение установлено!' });

      // Автоматически загружаем и отправляем историю сообщений при подключении
      try {
        console.log(`📜 WEBSOCKET: Автоматическая загрузка истории для пользователя ${(socket as any).userId}`);
        
        const messages = await strapi.entityService.findMany('api::message.message', {
          filters: {
            userId: (socket as any).userId.toString()
          },
          sort: { createdAt: 'asc' },
          populate: {
            user: {
              fields: ['id', 'username', 'email']
            }
          }
        });
        
        console.log(`📦 WEBSOCKET: Найдено сообщений для автозагрузки: ${messages.length}`);
        
        if (messages.length > 0) {
          socket.emit('messageHistory', messages);
          console.log(`✅ WEBSOCKET: История сообщений отправлена пользователю ${(socket as any).userId}`);
        }
        
      } catch (error) {
        console.error('💥 WEBSOCKET: Ошибка автозагрузки истории:', error);
      }

      // Тестовый обработчик для проверки
      socket.on('test', (data) => {
        console.log(`🧪 WEBSOCKET: Получен тестовый запрос от пользователя ${(socket as any).userId}:`, data);
        socket.emit('test-response', { message: 'Тест прошел успешно!', userId: (socket as any).userId });
      });

      // Обработка входа в комнату (для саппорта)
      socket.on('join', (data) => {
        const { userId } = data;
        if (userId && (socket as any).user.role?.type === 'support') {
          socket.join(`user-${userId}`);
          console.log(`🛠️ WEBSOCKET: Support joined room for user ${userId}`);
        }
      });

      // Обработка отправки сообщения (событие send-message)
      socket.on('send-message', async (data) => {
        try {
          console.log(`📨 WEBSOCKET: Получено сообщение от пользователя ${(socket as any).userId}:`, data);
          
          const { text, isFromSupport = false, targetUserId } = data;
          
          // Определяем целевого пользователя
          let userId = (socket as any).userId.toString();
          if (isFromSupport && targetUserId && (socket as any).user.role?.type === 'support') {
            userId = targetUserId;
          }

          console.log(`🎯 WEBSOCKET: Целевой пользователь: ${userId}`);

          // Проверяем права на отправку от саппорта
          const userIsSupport = (socket as any).user.role?.type === 'support' || (socket as any).user.role?.name === 'Support';
          if (isFromSupport && !userIsSupport) {
            console.log(`❌ WEBSOCKET: Пользователь ${(socket as any).userId} пытается отправить сообщение от саппорта без прав`);
            socket.emit('error', { message: 'Only support users can send support messages' });
            return;
          }

          // Создаем сообщение
          const messageData = {
            userId: userId,
            text,
            isFromSupport: userIsSupport ? isFromSupport : false,
            user: (socket as any).userId
          };

          console.log(`💾 WEBSOCKET: Сохраняем сообщение в БД:`, messageData);

          const message = await strapi.entityService.create('api::message.message', {
            data: messageData,
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });

          console.log(`✅ WEBSOCKET: Сообщение сохранено в БД:`, message);

          // Отправляем сообщение всем в комнате пользователя
          console.log(`📤 WEBSOCKET: Отправляем сообщение в комнату user-${userId}`);
          io.to(`user-${userId}`).emit('newMessage', message);
          
          console.log(`💬 WEBSOCKET: Message sent to user ${userId}`);
          
        } catch (error) {
          console.error('💥 WEBSOCKET: Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Дублирующий обработчик для стандартного события message
      socket.on('message', async (data) => {
        try {
          console.log(`📨 WEBSOCKET: Получено сообщение (через message) от пользователя ${(socket as any).userId}:`, data);
          
          const { text, isFromSupport = false, targetUserId } = data;
          
          // Определяем целевого пользователя
          let userId = (socket as any).userId.toString();
          if (isFromSupport && targetUserId && (socket as any).user.role?.type === 'support') {
            userId = targetUserId;
          }

          console.log(`🎯 WEBSOCKET: Целевой пользователь: ${userId}`);

          // Проверяем права на отправку от саппорта
          const userIsSupport = (socket as any).user.role?.type === 'support' || (socket as any).user.role?.name === 'Support';
          if (isFromSupport && !userIsSupport) {
            console.log(`❌ WEBSOCKET: Пользователь ${(socket as any).userId} пытается отправить сообщение от саппорта без прав`);
            socket.emit('error', { message: 'Only support users can send support messages' });
            return;
          }

          // Создаем сообщение
          const messageData = {
            userId: userId,
            text,
            isFromSupport: userIsSupport ? isFromSupport : false,
            user: (socket as any).userId
          };

          console.log(`💾 WEBSOCKET: Сохраняем сообщение в БД:`, messageData);

          const message = await strapi.entityService.create('api::message.message', {
            data: messageData,
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });

          console.log(`✅ WEBSOCKET: Сообщение сохранено в БД:`, message);

          // Отправляем сообщение всем в комнате пользователя
          console.log(`📤 WEBSOCKET: Отправляем сообщение в комнату user-${userId}`);
          io.to(`user-${userId}`).emit('newMessage', message);
          
          console.log(`💬 WEBSOCKET: Message sent to user ${userId}`);
          
        } catch (error) {
          console.error('💥 WEBSOCKET: Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Обработка получения истории сообщений
      socket.on('getMessages', async (data) => {
        try {
          console.log(`📜 WEBSOCKET: Запрос истории сообщений от пользователя ${(socket as any).userId}:`, data);
          
          const { userId } = data;
          let targetUserId = (socket as any).userId.toString();
          
          // Если саппорт запрашивает сообщения другого пользователя
          if (userId && (socket as any).user.role?.type === 'support') {
            targetUserId = userId;
          }

          console.log(`🎯 WEBSOCKET: Загружаем сообщения для пользователя: ${targetUserId}`);

          const messages = await strapi.entityService.findMany('api::message.message', {
            filters: {
              userId: targetUserId
            },
            sort: { createdAt: 'asc' },
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });
          
          console.log(`📦 WEBSOCKET: Найдено сообщений: ${messages.length}`);
          socket.emit('messageHistory', { messages });
          
        } catch (error) {
          console.error('💥 WEBSOCKET: Error getting messages:', error);
          socket.emit('error', { message: 'Failed to get messages', error: error.message });
        }
      });

      // Обработка отключения
      socket.on('disconnect', () => {
        console.log(`👤 WEBSOCKET: User ${(socket as any).userId} disconnected`);
      });
    });

    // Сохраняем ссылку на io в strapi для использования в других местах
    (strapi as any).io = io;
    
    console.log('✅ WEBSOCKET: WebSocket сервер успешно инициализирован!');
    return io;

  } catch (error) {
    console.error('💥 WEBSOCKET: Ошибка инициализации:', error);
    return null;
  }
}; 