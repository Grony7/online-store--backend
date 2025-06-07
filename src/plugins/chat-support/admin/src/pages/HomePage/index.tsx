import React, { useState, useEffect, useRef } from 'react';
import {
  Main,
  HeaderLayout,
  ContentLayout,
  Box,
  Grid,
  GridItem,
  Typography,
  Button,
  TextInput,
  Textarea,
  Loader,
  Alert,
  Badge,
  Flex,
  Card,
  CardBody,
  CardHeader,
} from '@strapi/design-system';
import { Refresh, Message, User, Clock, Send } from '@strapi/icons';
import { useNotification, useAuth, useFetchClient } from '@strapi/strapi/admin';
import io from 'socket.io-client';
import styled from 'styled-components';

// Стилизованные компоненты для лучшего внешнего вида
const ChatContainer = styled(Box)`
  height: 600px;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: white;
`;

const ChatsList = styled(Box)`
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.neutral200};
`;

const ChatItem = styled(Card)<{ $isActive: boolean }>`
  margin: 0;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 0;
  cursor: pointer;
  background-color: ${({ theme, $isActive }) => 
    $isActive ? theme.colors.primary100 : 'white'};
  
  &:hover {
    background-color: ${({ theme, $isActive }) => 
      $isActive ? theme.colors.primary100 : theme.colors.neutral100};
  }
`;

const MessagesContainer = styled(Box)`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spaces[4]};
  background-color: ${({ theme }) => theme.colors.neutral50};
`;

const MessageBubble = styled(Box)<{ $isFromSupport: boolean }>`
  max-width: 70%;
  margin-bottom: ${({ theme }) => theme.spaces[3]};
  padding: ${({ theme }) => theme.spaces[3]} ${({ theme }) => theme.spaces[4]};
  border-radius: ${({ theme }) => theme.borderRadius};
  align-self: ${({ $isFromSupport }) => $isFromSupport ? 'flex-end' : 'flex-start'};
  background-color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? theme.colors.primary600 : 'white'};
  color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'white' : theme.colors.neutral800};
  border: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'none' : `1px solid ${theme.colors.neutral200}`};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const MessageTime = styled(Typography)`
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: ${({ theme }) => theme.spaces[1]};
`;

const ChatInputContainer = styled(Box)`
  border-top: 1px solid ${({ theme }) => theme.colors.neutral200};
  padding: ${({ theme }) => theme.spaces[4]};
  background-color: white;
`;

const OnlineIndicator = styled(Box)<{ $isOnline: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ $isOnline }) => $isOnline ? '#4caf50' : '#f44336'};
  margin-right: ${({ theme }) => theme.spaces[2]};
`;

interface User {
  id: number;
  username?: string;
  email: string;
  createdAt?: string;
}

interface Message {
  id: number;
  text: string;
  isFromSupport: boolean;
  createdAt: string;
  userId: string;
  user?: User;
}

interface Chat {
  userId: string;
  user: User;
  lastMessageTime: string;
  lastMessage?: Message;
  unreadCount?: number;
}

const HomePage: React.FC = () => {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { get, post } = useFetchClient();
  const toggleNotification = useNotification();

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Загрузка списка активных чатов
  const loadActiveChats = async () => {
    try {
      setIsLoadingChats(true);
      
      const response = await get('/messages/chats/all');
      
      console.log('Загружены активные чаты:', response.data);
      setActiveChats(response.data.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки чатов:', error);
      toggleNotification({
        type: 'warning',
        message: 'Ошибка загрузки списка чатов',
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Загрузка истории сообщений для выбранного чата
  const loadChatHistory = async (userId: string) => {
    try {
      setIsLoading(true);
      
      const response = await get(`/messages/user/${userId}`);
      
      console.log('Загружена история чата:', response.data);
      setMessages(response.data.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки истории чата:', error);
      toggleNotification({
        type: 'warning',
        message: 'Ошибка загрузки истории сообщений',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Инициализация WebSocket соединения
  useEffect(() => {
    loadActiveChats();

    // Получаем токен из auth context
    const token = localStorage.getItem('jwtToken');
    
    if (!token) {
      toggleNotification({
        type: 'warning',
        message: 'Токен аутентификации не найден',
      });
      return;
    }

    const newSocket = io('http://localhost:1337', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Подключение поддержки к WebSocket установлено');
      setIsConnected(true);
      toggleNotification({
        type: 'success',
        message: 'Соединение с чатом установлено',
      });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket соединение поддержки разорвано');
      setIsConnected(false);
    });

    newSocket.on('newMessage', (message: Message) => {
      console.log('Получено новое сообщение в поддержке:', message);
      
      // Показываем уведомление о новом сообщении
      if (!message.isFromSupport) {
        toggleNotification({
          type: 'info',
          message: `Новое сообщение от пользователя ${message.userId}`,
        });
      }
      
      // Обновляем сообщения, если это активный чат
      if (selectedChat && message.userId === selectedChat.userId) {
        setMessages(prevMessages => [...prevMessages, message]);
      }
      
      // Обновляем список чатов
      loadActiveChats();
    });

    newSocket.on('connect_error', (error: any) => {
      console.error('Ошибка подключения WebSocket поддержки:', error);
      toggleNotification({
        type: 'warning',
        message: 'Ошибка подключения к чату',
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Выбор чата для просмотра
  const selectChat = (chat: Chat) => {
    setSelectedChat(chat);
    loadChatHistory(chat.userId);
    
    // Присоединяемся к комнате пользователя через WebSocket
    if (socket) {
      socket.emit('join', { userId: chat.userId });
    }
  };

  // Отправка сообщения от поддержки
  const sendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat || !isConnected) {
      return;
    }

    try {
      // Отправляем сообщение через REST API
      const response = await post('/messages/support/send', {
        data: {
          targetUserId: selectedChat.userId,
          text: newMessage
        }
      });

      console.log('Сообщение поддержки отправлено:', response.data);
      
      // Добавляем сообщение в локальное состояние
      const supportMessage: Message = {
        ...response.data.data,
        isFromSupport: true
      };
      
      setMessages(prevMessages => [...prevMessages, supportMessage]);
      setNewMessage('');
      
      // Показываем уведомление об успешной отправке
      toggleNotification({
        type: 'success',
        message: 'Сообщение отправлено',
      });
      
      // Обновляем список чатов
      loadActiveChats();
    } catch (error: any) {
      console.error('Ошибка отправки сообщения поддержки:', error);
      toggleNotification({
        type: 'warning',
        message: 'Ошибка отправки сообщения',
      });
    }
  };

  // Принудительное обновление
  const refreshChats = () => {
    loadActiveChats();
    if (selectedChat) {
      loadChatHistory(selectedChat.userId);
    }
    toggleNotification({
      type: 'info',
      message: 'Данные обновлены',
    });
  };

  // Форматирование времени
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Форматирование относительного времени
  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин. назад`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ч. назад`;
    return formatTime(dateString);
  };

  return (
    <Main>
      <HeaderLayout
        title="Чат поддержки"
        subtitle="Управление обращениями пользователей в реальном времени"
        primaryAction={
          <Flex gap={3}>
            <Badge 
              backgroundColor={isConnected ? 'success100' : 'danger100'}
              textColor={isConnected ? 'success600' : 'danger600'}
            >
              <OnlineIndicator $isOnline={isConnected} />
              {isConnected ? 'Подключено' : 'Не подключено'}
            </Badge>
            <Button
              onClick={refreshChats}
              startIcon={<Refresh />}
              variant="secondary"
            >
              Обновить
            </Button>
          </Flex>
        }
      />

      <ContentLayout>
        <Grid gap={6}>
          <GridItem col={4}>
            <Box>
              <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
                <Typography variant="delta">Активные чаты</Typography>
                <Badge backgroundColor="neutral100" textColor="neutral600">
                  {activeChats.length}
                </Badge>
              </Flex>
              
              <ChatContainer>
                <ChatsList>
                  {isLoadingChats ? (
                    <Box padding={6} textAlign="center">
                      <Loader />
                      <Typography variant="omega" marginTop={3}>
                        Загрузка чатов...
                      </Typography>
                    </Box>
                  ) : activeChats.length === 0 ? (
                    <Box padding={6} textAlign="center">
                      <Typography variant="omega" textColor="neutral600">
                        Нет активных чатов
                      </Typography>
                      <Typography variant="pi" textColor="neutral500" marginTop={2}>
                        Чаты появятся, когда пользователи начнут писать
                      </Typography>
                    </Box>
                  ) : (
                    activeChats.map((chat) => (
                      <ChatItem
                        key={chat.userId}
                        $isActive={selectedChat?.userId === chat.userId}
                        onClick={() => selectChat(chat)}
                      >
                        <CardBody padding={4}>
                          <Flex alignItems="center" gap={3} marginBottom={2}>
                            <User size="S" />
                            <Typography variant="omega" fontWeight="bold" ellipsis>
                              {chat.user?.username || chat.user?.email || `Пользователь ${chat.userId}`}
                            </Typography>
                          </Flex>
                          
                          <Flex alignItems="center" gap={2} marginBottom={2}>
                            <Clock size="S" />
                            <Typography variant="pi" textColor="neutral600">
                              {formatRelativeTime(chat.lastMessageTime)}
                            </Typography>
                          </Flex>
                          
                          {chat.lastMessage && (
                            <Typography variant="pi" textColor="neutral700" ellipsis>
                              {chat.lastMessage.isFromSupport ? '👨‍💼 ' : '👤 '}
                              {chat.lastMessage.text}
                            </Typography>
                          )}
                        </CardBody>
                      </ChatItem>
                    ))
                  )}
                </ChatsList>
              </ChatContainer>
            </Box>
          </GridItem>

          <GridItem col={8}>
            {!selectedChat ? (
              <Box padding={10} textAlign="center">
                <Message size="L" />
                <Typography variant="alpha" marginTop={4}>
                  Выберите чат для просмотра
                </Typography>
                <Typography variant="omega" textColor="neutral600" marginTop={2}>
                  Выберите чат из списка слева для начала общения с пользователем
                </Typography>
              </Box>
            ) : (
              <ChatContainer>
                <CardHeader>
                  <Box padding={4}>
                    <Flex alignItems="center" gap={3}>
                      <User size="M" />
                      <Box>
                        <Typography variant="beta">
                          {selectedChat.user?.username || selectedChat.user?.email || `Пользователь ${selectedChat.userId}`}
                        </Typography>
                        <Typography variant="pi" textColor="neutral600">
                          {selectedChat.user?.email && `${selectedChat.user.email} • `}
                          Регистрация: {selectedChat.user?.createdAt ? formatTime(selectedChat.user.createdAt) : 'Неизвестно'}
                        </Typography>
                      </Box>
                    </Flex>
                  </Box>
                </CardHeader>
                
                <MessagesContainer>
                  {isLoading ? (
                    <Box textAlign="center" padding={6}>
                      <Loader />
                      <Typography variant="omega" marginTop={3}>
                        Загрузка сообщений...
                      </Typography>
                    </Box>
                  ) : messages.length === 0 ? (
                    <Box textAlign="center" padding={6}>
                      <Typography variant="omega" textColor="neutral600">
                        История сообщений пуста
                      </Typography>
                      <Typography variant="pi" textColor="neutral500" marginTop={2}>
                        Начните переписку с пользователем
                      </Typography>
                    </Box>
                  ) : (
                    <Flex direction="column">
                      {messages.map((message) => (
                        <Flex
                          key={message.id}
                          justifyContent={message.isFromSupport ? 'flex-end' : 'flex-start'}
                          marginBottom={3}
                        >
                          <MessageBubble $isFromSupport={message.isFromSupport}>
                            <Typography variant="omega">
                              {message.text}
                            </Typography>
                            <MessageTime variant="pi">
                              {formatTime(message.createdAt)}
                              {message.isFromSupport && ' • Поддержка'}
                            </MessageTime>
                          </MessageBubble>
                        </Flex>
                      ))}
                    </Flex>
                  )}
                  <div ref={messagesEndRef} />
                </MessagesContainer>

                <ChatInputContainer>
                  <form onSubmit={sendSupportMessage}>
                    <Flex gap={3} alignItems="end">
                      <Box flex="1">
                        <Textarea
                          label="Ваш ответ"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Введите ответ пользователю..."
                          disabled={!isConnected}
                          rows={3}
                        />
                      </Box>
                      <Button
                        type="submit"
                        disabled={!isConnected || !newMessage.trim()}
                        startIcon={<Send />}
                        size="L"
                      >
                        Отправить
                      </Button>
                    </Flex>
                    
                    {!isConnected && (
                      <Box marginTop={3}>
                        <Alert variant="danger" title="Нет соединения">
                          Соединение с чатом отсутствует. Попробуйте обновить страницу.
                        </Alert>
                      </Box>
                    )}
                  </form>
                </ChatInputContainer>
              </ChatContainer>
            )}
          </GridItem>
        </Grid>
      </ContentLayout>
    </Main>
  );
};

export default HomePage; 