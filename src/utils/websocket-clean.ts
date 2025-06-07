import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

export const initializeWebSocket = (strapi: any) => {
  try {
    if (!strapi.server?.httpServer) {
      return null;
    }

    const io = new SocketIOServer(strapi.server.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

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
        next(new Error('Authentication error'));
      }
    });

    // Обработка подключений
    io.on('connection', async (socket) => {
      // Присоединяем пользователя к его персональной комнате
      socket.join(`user-${(socket as any).userId}`);
      
      // Отправляем тестовое сообщение для проверки
      socket.emit('test', { message: 'WebSocket соединение установлено!' });

      // Автоматически загружаем и отправляем историю сообщений при подключении
      try {
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
        
        if (messages.length > 0) {
          socket.emit('messageHistory', messages);
        }
        
      } catch (error) {
        // Игнорируем ошибки автозагрузки
      }

      // Тестовый обработчик для проверки
      socket.on('test', (data) => {
        socket.emit('test-response', { message: 'Тест прошел успешно!', userId: (socket as any).userId });
      });

      // Обработка входа в комнату (для саппорта)
      socket.on('join', (data) => {
        const { userId } = data;
        if (userId && (socket as any).user.role?.type === 'support') {
          socket.join(`user-${userId}`);
        }
      });

      // Обработка отправки сообщения
      socket.on('send-message', async (data) => {
        try {
          const { text, isFromSupport = false, targetUserId } = data;
          
          // Определяем целевого пользователя
          let userId = (socket as any).userId.toString();
          if (isFromSupport && targetUserId && (socket as any).user.role?.type === 'support') {
            userId = targetUserId;
          }

          // Проверяем права на отправку от саппорта
          const userIsSupport = (socket as any).user.role?.type === 'support' || (socket as any).user.role?.name === 'Support';
          if (isFromSupport && !userIsSupport) {
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

          const message = await strapi.entityService.create('api::message.message', {
            data: messageData,
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });

          // Отправляем сообщение всем в комнате пользователя
          io.to(`user-${userId}`).emit('newMessage', message);
          
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Дублирующий обработчик для стандартного события message
      socket.on('message', async (data) => {
        try {
          const { text, isFromSupport = false, targetUserId } = data;
          
          // Определяем целевого пользователя
          let userId = (socket as any).userId.toString();
          if (isFromSupport && targetUserId && (socket as any).user.role?.type === 'support') {
            userId = targetUserId;
          }

          // Проверяем права на отправку от саппорта
          const userIsSupport = (socket as any).user.role?.type === 'support' || (socket as any).user.role?.name === 'Support';
          if (isFromSupport && !userIsSupport) {
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

          const message = await strapi.entityService.create('api::message.message', {
            data: messageData,
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });

          // Отправляем сообщение всем в комнате пользователя
          io.to(`user-${userId}`).emit('newMessage', message);
          
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Обработка запроса истории сообщений
      socket.on('getMessageHistory', async (data) => {
        try {
          const { targetUserId } = data;
          
          // Определяем пользователя для которого загружаем историю
          let userId = (socket as any).userId.toString();
          if (targetUserId && (socket as any).user.role?.type === 'support') {
            userId = targetUserId;
          }

          const messages = await strapi.entityService.findMany('api::message.message', {
            filters: {
              userId: userId
            },
            sort: { createdAt: 'asc' },
            populate: {
              user: {
                fields: ['id', 'username', 'email']
              }
            }
          });

          socket.emit('messageHistory', messages);
          
        } catch (error) {
          socket.emit('error', { message: 'Failed to load message history', error: error.message });
        }
      });

      // Обработка отключения
      socket.on('disconnect', () => {
        // Пользователь отключился
      });
    });

    // Сохраняем ссылку на io в strapi для использования в других частях приложения
    (strapi as any).io = io;

    return io;
  } catch (error) {
    return null;
  }
}; 