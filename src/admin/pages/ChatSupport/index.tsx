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
  Loader,
  Alert,
  Badge,
  Flex,
  IconButton,
} from '@strapi/design-system';
import { Refresh, Message, User, Clock } from '@strapi/icons';
import { useAuth } from '@strapi/strapi/admin';
import { useFetchClient } from '@strapi/strapi/admin';
import io from 'socket.io-client';
import styled from 'styled-components';

// Стилизованные компоненты
const ChatContainer = styled(Box)`
  height: 600px;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
`;

const ChatsList = styled(Box)`
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.neutral200};
`;

const ChatItem = styled(Box)<{ $isActive: boolean }>`
  padding: ${({ theme }) => theme.spaces[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
  cursor: pointer;
  background-color: ${({ theme, $isActive }) => 
    $isActive ? theme.colors.primary100 : 'transparent'};
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.neutral100};
  }
`;

const MessagesContainer = styled(Box)`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spaces[3]};
  background-color: ${({ theme }) => theme.colors.neutral50};
`;

const MessageBubble = styled(Box)<{ $isFromSupport: boolean }>`
  max-width: 70%;
  margin-bottom: ${({ theme }) => theme.spaces[2]};
  padding: ${({ theme }) => theme.spaces[2]} ${({ theme }) => theme.spaces[3]};
  border-radius: ${({ theme }) => theme.borderRadius};
  align-self: ${({ $isFromSupport }) => $isFromSupport ? 'flex-end' : 'flex-start'};
  background-color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? theme.colors.primary600 : 'white'};
  color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'white' : theme.colors.neutral800};
  border: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'none' : `1px solid ${theme.colors.neutral200}`};
`;

const MessageTime = styled(Typography)`
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: ${({ theme }) => theme.spaces[1]};
`;

const ChatInputContainer = styled(Box)`
  border-top: 1px solid ${({ theme }) => theme.colors.neutral200};
  padding: ${({ theme }) => theme.spaces[3]};
  background-color: white;
`;

interface User {
  id: number;
  username?: string;
  email: string;
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
}

const ChatSupportPage: React.FC = () => {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { get, post } = useFetchClient();

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Загрузка списка активных чатов
  const loadActiveChats = async () => {
    try {
      setIsLoadingChats(true);
      setError(null);
      
      const response = await get('/messages/chats/all');
      
      console.log('Загружены активные чаты:', response.data);
      setActiveChats(response.data.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки чатов:', error);
      setError('Ошибка загрузки списка чатов');
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Загрузка истории сообщений для выбранного чата
  const loadChatHistory = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await get(`/messages/user/${userId}`);
      
      console.log('Загружена история чата:', response.data);
      setMessages(response.data.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки истории чата:', error);
      setError('Ошибка загрузки истории сообщений');
    } finally {
      setIsLoading(false);
    }
  };

  // Инициализация WebSocket соединения
  useEffect(() => {
    loadActiveChats();

    // Получаем токен из локального хранилища или auth context
    const token = localStorage.getItem('jwtToken') || (user as any)?.jwt;
    
    if (!token) {
      setError('Токен аутентификации не найден');
      return;
    }

    const newSocket = io('http://localhost:1337', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Подключение поддержки к WebSocket установлено');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket соединение поддержки разорвано');
      setIsConnected(false);
    });

    newSocket.on('newMessage', (message: Message) => {
      console.log('Получено новое сообщение в поддержке:', message);
      
      // Обновляем сообщения, если это активный чат
      if (selectedChat && message.userId === selectedChat.userId) {
        setMessages(prevMessages => [...prevMessages, message]);
      }
      
      // Обновляем список чатов
      loadActiveChats();
    });

    newSocket.on('connect_error', (error: any) => {
      console.error('Ошибка подключения WebSocket поддержки:', error);
      setError('Ошибка подключения к чату');
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
      setError(null);
      
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
      
      // Обновляем список чатов
      loadActiveChats();
    } catch (error: any) {
      console.error('Ошибка отправки сообщения поддержки:', error);
      setError('Ошибка отправки сообщения');
    }
  };

  // Принудительное обновление
  const refreshChats = () => {
    loadActiveChats();
    if (selectedChat) {
      loadChatHistory(selectedChat.userId);
    }
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

  return (
    <Main>
      <HeaderLayout
        title="Чат поддержки"
        subtitle="Управление обращениями пользователей"
        primaryAction={
          <Button
            onClick={refreshChats}
            startIcon={<Refresh />}
            variant="secondary"
          >
            Обновить
          </Button>
        }
      />

      <ContentLayout>
        {error && (
          <Box marginBottom={4}>
            <Alert variant="danger" title="Ошибка">
              {error}
            </Alert>
          </Box>
        )}

        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Typography variant="omega">
            Статус подключения: {' '}
            <Badge 
              backgroundColor={isConnected ? 'success100' : 'danger100'}
              textColor={isConnected ? 'success600' : 'danger600'}
            >
              {isConnected ? 'Подключено' : 'Не подключено'}
            </Badge>
          </Typography>
        </Flex>

        <Grid gap={4}>
          <GridItem col={4}>
            <Box>
              <Flex justifyContent="space-between" alignItems="center" marginBottom={3}>
                <Typography variant="delta">Активные чаты</Typography>
                <Badge backgroundColor="neutral100" textColor="neutral600">
                  {activeChats.length}
                </Badge>
              </Flex>
              
              <ChatContainer>
                <ChatsList>
                  {isLoadingChats ? (
                    <Box padding={4} textAlign="center">
                      <Loader />
                      <Typography variant="omega" marginTop={2}>
                        Загрузка чатов...
                      </Typography>
                    </Box>
                  ) : activeChats.length === 0 ? (
                    <Box padding={4} textAlign="center">
                      <Typography variant="omega" textColor="neutral600">
                        Нет активных чатов
                      </Typography>
                    </Box>
                  ) : (
                    activeChats.map((chat) => (
                      <ChatItem
                        key={chat.userId}
                        $isActive={selectedChat?.userId === chat.userId}
                        onClick={() => selectChat(chat)}
                      >
                        <Flex alignItems="center" gap={2} marginBottom={2}>
                          <User size="small" />
                          <Typography variant="omega" fontWeight="bold">
                            {chat.user?.username || chat.user?.email || `Пользователь ${chat.userId}`}
                          </Typography>
                        </Flex>
                        
                        <Flex alignItems="center" gap={1} marginBottom={1}>
                          <Clock size="small" />
                          <Typography variant="pi" textColor="neutral600">
                            {formatTime(chat.lastMessageTime)}
                          </Typography>
                        </Flex>
                        
                        {chat.lastMessage && (
                          <Typography variant="pi" textColor="neutral700" ellipsis>
                            {chat.lastMessage.isFromSupport ? '👨‍💼 ' : '👤 '}
                            {chat.lastMessage.text}
                          </Typography>
                        )}
                      </ChatItem>
                    ))
                  )}
                </ChatsList>
              </ChatContainer>
            </Box>
          </GridItem>

          <GridItem col={8}>
            {!selectedChat ? (
              <Box padding={8} textAlign="center">
                <Message size="large" />
                <Typography variant="delta" marginTop={4}>
                  Выберите чат для просмотра сообщений
                </Typography>
                <Typography variant="omega" textColor="neutral600" marginTop={2}>
                  Выберите чат из списка слева для начала общения
                </Typography>
              </Box>
            ) : (
              <ChatContainer>
                <Box padding={3} borderBottom="1px solid" borderColor="neutral200">
                  <Typography variant="delta">
                    Чат с {selectedChat.user?.username || selectedChat.user?.email || `пользователем ${selectedChat.userId}`}
                  </Typography>
                </Box>
                
                <MessagesContainer>
                  {isLoading ? (
                    <Box textAlign="center" padding={4}>
                      <Loader />
                      <Typography variant="omega" marginTop={2}>
                        Загрузка сообщений...
                      </Typography>
                    </Box>
                  ) : messages.length === 0 ? (
                    <Box textAlign="center" padding={4}>
                      <Typography variant="omega" textColor="neutral600">
                        История сообщений пуста
                      </Typography>
                    </Box>
                  ) : (
                    <Flex direction="column">
                      {messages.map((message) => (
                        <Flex
                          key={message.id}
                          justifyContent={message.isFromSupport ? 'flex-end' : 'flex-start'}
                          marginBottom={2}
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
                    <Flex gap={2} alignItems="end">
                      <Box flex="1">
                        <TextInput
                          label="Ваш ответ"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Введите ответ пользователю..."
                          disabled={!isConnected}
                        />
                      </Box>
                      <Button
                        type="submit"
                        disabled={!isConnected || !newMessage.trim()}
                        startIcon={<Message />}
                      >
                        Отправить
                      </Button>
                    </Flex>
                    
                    {!isConnected && (
                      <Box marginTop={2}>
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

export { default } from '../ChatSupport'; 