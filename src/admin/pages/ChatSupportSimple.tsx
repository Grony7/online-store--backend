import React, { useState, useEffect, useRef } from 'react';

// Функция для получения токена авторизации из админки Strapi
const getAuthToken = () => {
  // Пробуем разные способы получения токена в Strapi 5
  const token = 
    // Из Redux Store админки
    window?.strapi?.store?.getState?.()?.admin_app?.permissions?.userInfo?.token ||
    // Из localStorage (различные ключи)
    localStorage.getItem('strapi-jwt-token') ||
    localStorage.getItem('jwtToken') ||
    localStorage.getItem('strapiToken') ||
    // Из sessionStorage
    sessionStorage.getItem('strapi-jwt-token') ||
    sessionStorage.getItem('jwtToken') ||
    // Из cookies (если используются)
    document.cookie.split(';').find(c => c.trim().startsWith('strapi-jwt='))?.split('=')[1] ||
    null;
    

  
  return token;
};

const ChatSupportSimple: React.FC = () => {
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
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
      
      const strapiToken = getAuthToken();
      
      const response = await fetch('/api/admin/chats/all', {
        headers: {
          'Authorization': `Bearer ${strapiToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveChats(data.data || []);
        setIsConnected(true);
      } else {
        setIsConnected(false);
        
        // Добавляем тестовые данные для демонстрации интерфейса
        setActiveChats([
          {
            userId: 'test-user-1',
            user: {
              id: 1,
              username: 'test_user',
              email: 'test@example.com',
              createdAt: new Date().toISOString()
            },
            lastMessageTime: new Date().toISOString(),
            lastMessage: {
              id: 1,
              text: 'Привет! У меня вопрос по заказу',
              isFromSupport: false,
              createdAt: new Date().toISOString(),
              userId: 'test-user-1'
            }
          },
          {
            userId: 'test-user-2', 
            user: {
              id: 2,
              username: 'another_user',
              email: 'user2@example.com',
              createdAt: new Date().toISOString()
            },
            lastMessageTime: new Date(Date.now() - 3600000).toISOString(), // час назад
            lastMessage: {
              id: 2,
              text: 'Спасибо за помощь!',
              isFromSupport: false,
              createdAt: new Date(Date.now() - 3600000).toISOString(),
              userId: 'test-user-2'
            }
          }
        ]);
      }
    } catch (error: any) {
      setIsConnected(false);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Загрузка истории сообщений для выбранного чата
  const loadChatHistory = async (userId: string) => {
    try {
      setIsLoading(true);
      
      const strapiToken = getAuthToken();
        
      const response = await fetch(`/api/admin/chats/${userId}/history`, {
        headers: {
          'Authorization': `Bearer ${strapiToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
        scrollToBottom();
      }
    } catch (error: any) {
      // Игнорируем ошибки загрузки
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
  const selectChat = (chat: any) => {
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
      const strapiToken = getAuthToken();
        
      const response = await fetch('/api/admin/chats/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${strapiToken}`,
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
        
        // Добавляем сообщение в локальное состояние
        const supportMessage = {
          ...data.data,
          isFromSupport: true,
          text: messageText
        };
        
        setMessages(prevMessages => [...prevMessages, supportMessage]);
        
        // Обновляем список чатов
        setTimeout(loadActiveChats, 500);
      } else {
        setNewMessage(messageText); // Возвращаем текст в поле
        alert('Ошибка отправки сообщения. Попробуйте еще раз.');
      }
    } catch (error: any) {
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
  const getUserInitials = (user: any) => {
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      {/* Заголовок */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#333', fontSize: '24px' }}>
            💬 Чат поддержки
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>
            Общение с пользователями в реальном времени
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: '15px',
            fontSize: '12px',
            backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
            color: isConnected ? '#155724' : '#721c24'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#28a745' : '#dc3545',
              marginRight: '5px'
            }}></span>
            {isConnected ? 'Подключено' : 'Не подключено'}
          </span>
          <button 
            onClick={refreshChats}
            style={{
              padding: '8px 15px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div style={{ display: 'flex', gap: '20px', height: '70vh' }}>
        
        {/* Левая панель - список чатов */}
        <div style={{
          width: '350px',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            padding: '15px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0 }}>Активные чаты</h3>
            <span style={{
              backgroundColor: '#e9ecef',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px'
            }}>
              {activeChats.length}
            </span>
          </div>
          
          <div style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
            {isLoadingChats ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div>⏳ Загрузка чатов...</div>
              </div>
            ) : activeChats.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
                <div>Нет активных чатов</div>
                <div style={{ fontSize: '12px', marginTop: '5px' }}>
                  Чаты появятся, когда пользователи начнут писать
                </div>
              </div>
            ) : (
              activeChats.map((chat) => (
                <div
                  key={chat.userId}
                  onClick={() => selectChat(chat)}
                  style={{
                    padding: '15px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    backgroundColor: selectedChat?.userId === chat.userId ? '#e3f2fd' : 'white',
                    transition: 'background-color 0.2s',
                    ':hover': {
                      backgroundColor: '#f5f5f5'
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (selectedChat?.userId !== chat.userId) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedChat?.userId !== chat.userId) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {getUserInitials(chat.user)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {chat.user?.username || chat.user?.email || `Пользователь ${chat.userId}`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        🕒 {formatRelativeTime(chat.lastMessageTime)}
                      </div>
                    </div>
                  </div>
                  
                  {chat.lastMessage && (
                    <div style={{ 
                      marginTop: '10px', 
                      paddingTop: '10px', 
                      borderTop: '1px solid #eee',
                      fontSize: '12px',
                      color: '#555'
                    }}>
                      {chat.lastMessage.isFromSupport ? '👨‍💼 Поддержка: ' : '👤 Пользователь: '}
                      {chat.lastMessage.text.length > 50 
                        ? chat.lastMessage.text.substring(0, 50) + '...'
                        : chat.lastMessage.text
                      }
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Правая панель - чат */}
        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {!selectedChat ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
              <h2>Выберите чат для просмотра</h2>
              <p>Выберите чат из списка слева для начала общения с пользователем</p>
            </div>
          ) : (
            <>
              {/* Заголовок чата */}
              <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #eee',
                backgroundColor: '#f8f9fa'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    {getUserInitials(selectedChat.user)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {selectedChat.user?.username || selectedChat.user?.email || `Пользователь ${selectedChat.userId}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {selectedChat.user?.email && `${selectedChat.user.email} • `}
                      Регистрация: {selectedChat.user?.createdAt ? formatTime(selectedChat.user.createdAt) : 'Неизвестно'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Область сообщений */}
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)'
              }}>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div>⏳ Загрузка сообщений...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <div>История сообщений пуста</div>
                    <div style={{ fontSize: '12px', marginTop: '5px' }}>
                      Начните переписку с пользователем
                    </div>
                  </div>
                ) : (
                  <div>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        style={{
                          display: 'flex',
                          justifyContent: message.isFromSupport ? 'flex-end' : 'flex-start',
                          marginBottom: '15px'
                        }}
                      >
                        <div style={{
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: '18px',
                          backgroundColor: message.isFromSupport ? '#007bff' : 'white',
                          color: message.isFromSupport ? 'white' : '#333',
                          border: message.isFromSupport ? 'none' : '1px solid #e0e0e0',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          animation: 'slideIn 0.3s ease-out'
                        }}>
                          <div style={{ marginBottom: '5px' }}>
                            {message.text}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            opacity: 0.8,
                            textAlign: 'right'
                          }}>
                            {formatTime(message.createdAt)}
                            {message.isFromSupport && ' • Поддержка'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Поле ввода */}
              <div style={{
                padding: '20px',
                borderTop: '1px solid #eee',
                backgroundColor: 'white'
              }}>
                <form onSubmit={sendSupportMessage}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Введите ответ пользователю..."
                      disabled={!isConnected}
                      rows={3}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        resize: 'none',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!isConnected || !newMessage.trim()}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: (!isConnected || !newMessage.trim()) ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (!isConnected || !newMessage.trim()) ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      📤 Отправить
                    </button>
                  </div>
                  
                  {!isConnected && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#f8d7da',
                      color: '#721c24',
                      borderRadius: '5px',
                      fontSize: '14px'
                    }}>
                      ⚠️ Нет соединения с сервером. Попробуйте обновить страницу.
                    </div>
                  )}
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSupportSimple; 