import React, { useState, useEffect, useRef } from 'react';
import {
  Main,
  Box,
  Grid,
  GridItem,
  Typography,
  Button,
  Textarea,
  Loader,
  Alert,
  Badge,
  Flex,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from '@strapi/design-system';
import { 
  Layout,
  ContentLayout,
  HeaderLayout,
} from '@strapi/design-system/Layout';
import { Refresh, Message, User, Clock, Send, ArrowRight } from '@strapi/icons';
import styled from 'styled-components';

// Стилизованные компоненты для красивого интерфейса
const ChatContainer = styled(Box)`
  height: 70vh;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme, $isActive }) => 
      $isActive ? theme.colors.primary100 : theme.colors.neutral100};
    transform: translateX(2px);
  }
`;

const MessagesContainer = styled(Box)`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spaces[4]};
  background: linear-gradient(to bottom, #f8f9fa, #ffffff);
  max-height: calc(70vh - 140px);
`;

const MessageBubble = styled(Box)<{ $isFromSupport: boolean }>`
  max-width: 75%;
  margin-bottom: ${({ theme }) => theme.spaces[3]};
  padding: ${({ theme }) => theme.spaces[3]} ${({ theme }) => theme.spaces[4]};
  border-radius: 18px;
  background-color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? theme.colors.primary600 : 'white'};
  color: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'white' : theme.colors.neutral800};
  border: ${({ theme, $isFromSupport }) => 
    $isFromSupport ? 'none' : `1px solid ${theme.colors.neutral200}`};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  animation: slideIn 0.3s ease-out;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const MessageTime = styled(Typography)`
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: ${({ theme }) => theme.spaces[1]};
`;

const ChatInputContainer = styled(Box)`
  border-top: 1px solid ${({ theme }) => theme.colors.neutral200};
  padding: ${({ theme }) => theme.spaces[4]};
  background-color: white;
`;

const OnlineIndicator = styled(Box)<{ $isOnline: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${({ $isOnline }) => $isOnline ? '#4caf50' : '#f44336'};
  margin-right: ${({ theme }) => theme.spaces[2]};
  animation: ${({ $isOnline }) => $isOnline ? 'pulse 2s infinite' : 'none'};
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
    100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
  }
`;

const UserAvatar = styled(Box)`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  margin-right: ${({ theme }) => theme.spaces[3]};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

const ChatSupport: React.FC = () => {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Загрузка списка активных чатов
  const loadActiveChats = async () => {
    try {
      setIsLoadingChats(true);
      
      const token = localStorage.getItem('jwtToken') || localStorage.getItem('strapi-jwt-token');
      const response = await fetch('/api/messages/chats/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Загружены активные чаты:', data);
        setActiveChats(data.data || []);
        setIsConnected(true);
      } else {
        console.error('Ошибка загрузки чатов:', response.statusText);
        setIsConnected(false);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки чатов:', error);
      setIsConnected(false);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Загрузка истории сообщений для выбранного чата
  const loadChatHistory = async (userId: string) => {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('jwtToken') || localStorage.getItem('strapi-jwt-token');
      const response = await fetch(`/api/messages/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Загружена история чата:', data);
        setMessages(data.data || []);
        scrollToBottom();
      } else {
        console.error('Ошибка загрузки истории чата:', response.statusText);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки истории чата:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Инициализация при загрузке
  useEffect(() => {
    loadActiveChats();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadActiveChats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Выбор чата для просмотра
  const selectChat = (chat: Chat) => {
    setSelectedChat(chat);
    loadChatHistory(chat.userId);
  };

  // Отправка сообщения от поддержки
  const sendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat || !isConnected) {
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage(''); // Очищаем поле сразу для лучшего UX

    try {
      const token = localStorage.getItem('jwtToken') || localStorage.getItem('strapi-jwt-token');
      const response = await fetch('/api/messages/support/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            targetUserId: selectedChat.userId,
            text: messageText
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Сообщение поддержки отправлено:', data);
        
        // Добавляем сообщение в локальное состояние
        const supportMessage: Message = {
          ...data.data,
          isFromSupport: true,
          text: messageText
        };
        
        setMessages(prevMessages => [...prevMessages, supportMessage]);
        
        // Обновляем список чатов
        setTimeout(loadActiveChats, 500);
      } else {
        console.error('Ошибка отправки сообщения:', response.statusText);
        setNewMessage(messageText); // Возвращаем текст в поле
        alert('Ошибка отправки сообщения. Попробуйте еще раз.');
      }
    } catch (error: any) {
      console.error('Ошибка отправки сообщения поддержки:', error);
      setNewMessage(messageText); // Возвращаем текст в поле
      alert('Ошибка отправки сообщения. Проверьте соединение.');
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

  // Получение инициалов пользователя
  const getUserInitials = (user: User) => {
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Main>
      <HeaderLayout
        title="💬 Чат поддержки"
        subtitle="Общение с пользователями в реальном времени"
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
              size="S"
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
                <Typography variant="delta" fontWeight="semiBold">
                  Активные чаты
                </Typography>
                <Badge backgroundColor="neutral100" textColor="neutral600">
                  {activeChats.length}
                </Badge>
              </Flex>
              
              <ChatContainer>
                <ChatsList>
                  {isLoadingChats ? (
                    <Box padding={6} textAlign="center">
                      <Loader />
                      <Typography variant="omega" marginTop={3} textColor="neutral600">
                        Загрузка чатов...
                      </Typography>
                    </Box>
                  ) : activeChats.length === 0 ? (
                    <Box padding={6} textAlign="center">
                      <Message size="L" />
                      <Typography variant="omega" textColor="neutral600" marginTop={3}>
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
                          <Flex alignItems="center" gap={3} marginBottom={3}>
                            <UserAvatar>
                              {getUserInitials(chat.user)}
                            </UserAvatar>
                            <Box flex="1">
                              <Typography variant="omega" fontWeight="semiBold" ellipsis>
                                {chat.user?.username || chat.user?.email || `Пользователь ${chat.userId}`}
                              </Typography>
                              <Flex alignItems="center" gap={2} marginTop={1}>
                                <Clock size="S" />
                                <Typography variant="pi" textColor="neutral600">
                                  {formatRelativeTime(chat.lastMessageTime)}
                                </Typography>
                              </Flex>
                            </Box>
                            {selectedChat?.userId === chat.userId && (
                              <ArrowRight size="S" />
                            )}
                          </Flex>
                          
                          {chat.lastMessage && (
                            <>
                              <Divider />
                              <Box marginTop={3}>
                                <Typography variant="pi" textColor="neutral700" ellipsis>
                                  {chat.lastMessage.isFromSupport ? '👨‍💼 Поддержка: ' : '👤 Пользователь: '}
                                  {chat.lastMessage.text}
                                </Typography>
                              </Box>
                            </>
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
                      <UserAvatar>
                        {getUserInitials(selectedChat.user)}
                      </UserAvatar>
                      <Box>
                        <Typography variant="beta" fontWeight="semiBold">
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
                      <Typography variant="omega" marginTop={3} textColor="neutral600">
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

export default ChatSupport; 