import { Server as SocketIOServer } from 'socket.io';

declare module '@strapi/strapi' {
  interface Strapi {
    io?: SocketIOServer;
  }
}

export {}; 