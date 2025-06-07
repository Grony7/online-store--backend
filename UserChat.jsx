import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const UserChat = ({ userToken, currentUserId }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Подключение к WebSocket
  useEffect(() => {
    if (!userToken) return;

    console.log('🔌 Подключаемся к WebSocket с токеном:', userToken.substring(0, 10) + '...');

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:1337', {
      auth: { token: userToken },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Пользователь подключен к чату');
      setIsConnected(true);
      
      // Запрашиваем историю сообщений при подключении
      newSocket.emit('getMessages', {});
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Пользователь отключен от чата');
      setIsConnected(false);
    });

    newSocket.on('newMessage', (message) => {
      console.log('💬 Новое сообщение получено:', message);
      
      setMessages(prev => {
        // Проверяем, что сообщение еще не добавлено
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    newSocket.on('messageHistory', (data) => {
      console.log('📜 История сообщений получена:', data);
      setMessages(data.messages || []);
    });

    newSocket.on('error', (error) => {
      console.error('❌ WebSocket ошибка:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [userToken]);

  // Отправить сообщение через WebSocket
  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !isConnected) {
      console.log('❌ Не могу отправить сообщение:', { 
        hasMessage: !!newMessage.trim(), 
        hasSocket: !!socket, 
        isConnected 
      });
      return;
    }

    console.log('📤 Отправляем сообщение через WebSocket:', newMessage.trim());
    
    socket.emit('message', {
      text: newMessage.trim(),
      isFromSupport: false
    });

    setNewMessage('');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          💬
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '350px',
      height: '500px',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Заголовок */}
      <div style={{
        padding: '16px',
        background: '#007bff',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '16px' }}>💬 Поддержка</h4>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {isConnected ? '● Онлайн' : '● Подключение...'}
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0',
            width: '24px',
            height: '24px'
          }}
        >
          ×
        </button>
      </div>

      {/* Сообщения */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        background: '#f8f9fa'
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            marginTop: '50px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
            <div>Добро пожаловать в чат поддержки!</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              Напишите ваш вопрос.
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.isFromSupport ? 'flex-start' : 'flex-end',
                marginBottom: '12px'
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: '18px',
                background: message.isFromSupport ? '#e3f2fd' : '#007bff',
                color: message.isFromSupport ? '#333' : '#fff',
                border: message.isFromSupport ? '1px solid #ddd' : 'none'
              }}>
                <div>{message.text}</div>
                <div style={{
                  fontSize: '11px',
                  opacity: 0.7,
                  marginTop: '4px',
                  textAlign: 'right'
                }}>
                  {formatTime(message.createdAt)}
                  {message.isFromSupport && ' • Поддержка'}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #ddd',
        background: 'white'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isConnected ? "Введите сообщение..." : "Подключение..."}
            disabled={!isConnected}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            style={{
              padding: '8px 12px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              opacity: !newMessage.trim() || !isConnected ? 0.5 : 1,
              fontSize: '14px'
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserChat; 