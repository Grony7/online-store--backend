// Компонент для работы с чатом в админке Strapi
// Скопируйте в ваш React фронтенд для админов/саппорта

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const API_URL = 'http://localhost:1337';

const SupportChatAdmin = ({ authToken }) => {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const messagesEndRef = useRef(null);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Загрузка списка активных чатов
  const loadActiveChats = async () => {
    try {
      setIsLoadingChats(true);
      const response = await fetch(`${API_URL}/api/messages/chats/all`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Загружены активные чаты:', data);
        setActiveChats(data.data || []);
      } else {
        console.error('Ошибка загрузки чатов:', response.status);
      }
    } catch (error) {
      console.error('Ошибка при загрузке чатов:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Загрузка истории сообщений для выбранного чата
  const loadChatHistory = async (userId) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/messages/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Загружена история чата:', data);
        setMessages(data.data || []);
        
        // Сохраняем в localStorage
        localStorage.setItem(`support_chat_${userId}`, JSON.stringify(data.data || []));
      } else {
        console.error('Ошибка загрузки истории чата:', response.status);
        
        // Пытаемся загрузить из localStorage
        const cachedMessages = localStorage.getItem(`support_chat_${userId}`);
        if (cachedMessages) {
          setMessages(JSON.parse(cachedMessages));
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке истории чата:', error);
      
      // Пытаемся загрузить из localStorage при ошибке сети
      const cachedMessages = localStorage.getItem(`support_chat_${userId}`);
      if (cachedMessages) {
        setMessages(JSON.parse(cachedMessages));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Инициализация WebSocket соединения
  useEffect(() => {
    loadActiveChats();

    const newSocket = io(API_URL, {
      auth: {
        token: authToken
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Подключение поддержки к WebSocket установлено');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket соединение поддержки разорвано');
      setIsConnected(false);
    });

    newSocket.on('newMessage', (message) => {
      console.log('Получено новое сообщение в поддержке:', message);
      
      // Обновляем сообщения, если это активный чат
      if (selectedChat && message.userId === selectedChat.userId) {
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages, message];
          localStorage.setItem(`support_chat_${selectedChat.userId}`, JSON.stringify(updatedMessages));
          return updatedMessages;
        });
      }
      
      // Обновляем список чатов
      loadActiveChats();
    });

    newSocket.on('connect_error', (error) => {
      console.error('Ошибка подключения WebSocket поддержки:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [authToken]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Выбор чата для просмотра
  const selectChat = (chat) => {
    setSelectedChat(chat);
    loadChatHistory(chat.userId);
    
    // Присоединяемся к комнате пользователя через WebSocket
    if (socket) {
      socket.emit('join', { userId: chat.userId });
    }
  };

  // Отправка сообщения от поддержки
  const sendSupportMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat || !isConnected) {
      return;
    }

    try {
      // Отправляем сообщение через REST API
      const response = await fetch(`${API_URL}/api/messages/support/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            targetUserId: selectedChat.userId,
            text: newMessage
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Сообщение поддержки отправлено:', data);
        
        // Добавляем сообщение в локальное состояние
        const supportMessage = {
          ...data.data,
          isFromSupport: true
        };
        
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages, supportMessage];
          localStorage.setItem(`support_chat_${selectedChat.userId}`, JSON.stringify(updatedMessages));
          return updatedMessages;
        });

        setNewMessage('');
        
        // Обновляем список чатов
        loadActiveChats();
      } else {
        console.error('Ошибка отправки сообщения поддержки:', response.status);
      }
    } catch (error) {
      console.error('Ошибка при отправке сообщения поддержки:', error);
    }
  };

  // Принудительное обновление
  const refreshChats = () => {
    loadActiveChats();
    if (selectedChat) {
      loadChatHistory(selectedChat.userId);
    }
  };

  return (
    <div className="support-admin-container">
      <div className="support-header">
        <h2>Админка поддержки</h2>
        <div className="support-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Подключено' : 'Не подключено'}
          </span>
          <button onClick={refreshChats} className="refresh-btn" title="Обновить">
            ⟳
          </button>
        </div>
      </div>

      <div className="support-content">
        {/* Левая панель - список чатов */}
        <div className="chats-sidebar">
          <h3>Активные чаты</h3>
          {isLoadingChats ? (
            <div className="loading-chats">
              <div className="loading-spinner"></div>
              <p>Загрузка чатов...</p>
            </div>
          ) : activeChats.length === 0 ? (
            <div className="no-chats">
              <p>Нет активных чатов</p>
            </div>
          ) : (
            <div className="chats-list">
              {activeChats.map((chat) => (
                <div
                  key={chat.userId}
                  className={`chat-item ${selectedChat?.userId === chat.userId ? 'active' : ''}`}
                  onClick={() => selectChat(chat)}
                >
                  <div className="chat-user-info">
                    <div className="user-name">
                      {chat.user?.username || chat.user?.email || `Пользователь ${chat.userId}`}
                    </div>
                    <div className="last-message-time">
                      {new Date(chat.lastMessageTime).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  {chat.lastMessage && (
                    <div className="last-message">
                      {chat.lastMessage.isFromSupport ? '👨‍💼 ' : '👤 '}
                      {chat.lastMessage.text.substring(0, 50)}
                      {chat.lastMessage.text.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Правая панель - чат */}
        <div className="chat-panel">
          {!selectedChat ? (
            <div className="no-chat-selected">
              <p>Выберите чат для просмотра сообщений</p>
            </div>
          ) : (
            <div className="chat-container">
              <div className="chat-header">
                <h3>
                  Чат с {selectedChat.user?.username || selectedChat.user?.email || `пользователем ${selectedChat.userId}`}
                </h3>
              </div>
              
              <div className="chat-messages">
                {isLoading ? (
                  <div className="chat-loading">
                    <div className="loading-spinner"></div>
                    <p>Загрузка сообщений...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">
                    <p>История сообщений пуста</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`message ${message.isFromSupport ? 'support-message' : 'user-message'}`}
                    >
                      <div className="message-content">
                        <p>{message.text}</p>
                        <span className="message-time">
                          {new Date(message.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {message.isFromSupport && (
                        <div className="message-author">Поддержка</div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendSupportMessage} className="chat-input-form">
                <div className="input-group">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ответ пользователю..."
                    className="message-input"
                    disabled={!isConnected}
                  />
                  <button 
                    type="submit" 
                    className="send-button"
                    disabled={!isConnected || !newMessage.trim()}
                  >
                    Отправить
                  </button>
                </div>
                {!isConnected && (
                  <p className="connection-warning">
                    Соединение отсутствует. Попробуйте обновить страницу.
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportChatAdmin; 