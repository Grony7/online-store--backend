import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const API_URL = 'http://localhost:1337';

const Chat = ({ user, authToken }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Загрузка истории сообщений из API
  const loadMessageHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/messages/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Загружена история сообщений:', data);
        setMessages(data.data || []);
        
        // Сохраняем в localStorage для быстрого доступа
        localStorage.setItem(`chat_history_${user.id}`, JSON.stringify(data.data || []));
      } else {
        console.error('Ошибка загрузки истории сообщений:', response.status);
        
        // Пытаемся загрузить из localStorage
        const cachedMessages = localStorage.getItem(`chat_history_${user.id}`);
        if (cachedMessages) {
          setMessages(JSON.parse(cachedMessages));
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке истории сообщений:', error);
      
      // Пытаемся загрузить из localStorage при ошибке сети
      const cachedMessages = localStorage.getItem(`chat_history_${user.id}`);
      if (cachedMessages) {
        setMessages(JSON.parse(cachedMessages));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Сохранение сообщений в localStorage
  const saveMessagesToCache = (updatedMessages) => {
    localStorage.setItem(`chat_history_${user.id}`, JSON.stringify(updatedMessages));
  };

  // Инициализация WebSocket соединения
  useEffect(() => {
    // Сначала загружаем историю сообщений
    loadMessageHistory();

    // Затем подключаемся к WebSocket
    const newSocket = io(API_URL, {
      auth: {
        token: authToken
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Подключение к WebSocket установлено');
      setIsConnected(true);
      
      // Присоединяемся к комнате пользователя
      newSocket.emit('join', { userId: user.id });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket соединение разорвано');
      setIsConnected(false);
    });

    newSocket.on('newMessage', (message) => {
      console.log('Получено новое сообщение:', message);
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, message];
        saveMessagesToCache(updatedMessages);
        return updatedMessages;
      });
    });

    newSocket.on('messageHistory', (history) => {
      console.log('Получена история сообщений через WebSocket:', history);
      setMessages(history);
      saveMessagesToCache(history);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Ошибка подключения WebSocket:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user.id, authToken]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Отправка сообщения
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !isConnected) {
      return;
    }

    try {
      // Отправляем сообщение через REST API для гарантии сохранения
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            text: newMessage,
            isFromSupport: false
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Сообщение отправлено через API:', data);
        
        // Также отправляем через WebSocket для мгновенной доставки
        socket.emit('message', {
          text: newMessage,
          userId: user.id,
          isFromSupport: false
        });

        setNewMessage('');
      } else {
        console.error('Ошибка отправки сообщения:', response.status);
      }
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    }
  };

  // Принудительное обновление истории
  const refreshHistory = () => {
    loadMessageHistory();
  };

  if (isLoading) {
    return (
      <div className="chat-container">
        <div className="chat-loading">
          <div className="loading-spinner"></div>
          <p>Загрузка истории сообщений...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Чат поддержки</h3>
        <div className="chat-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Подключено' : 'Не подключено'}
          </span>
          <button onClick={refreshHistory} className="refresh-btn" title="Обновить историю">
            ⟳
          </button>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>История сообщений пуста</p>
            <p>Напишите первое сообщение!</p>
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

      <form onSubmit={sendMessage} className="chat-input-form">
        <div className="input-group">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите ваше сообщение..."
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
  );
};

export default Chat; 