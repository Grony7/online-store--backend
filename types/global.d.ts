import { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace Strapi {
    interface Strapi {
      io?: SocketIOServer;
    }
  }
}

// Расширяем Socket для наших кастомных свойств
declare module 'socket.io' {
  interface Socket {
    userId?: number;
    user?: {
      id: number;
      username: string;
      email: string;
      role?: {
        id: number;
        name: string;
        type: string;
      };
    };
  }
}

// Типы для JWT payload
export interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

export {}; 