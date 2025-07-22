import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Main.css';
import '../styles/MyPage.css';

const Ticket = ({ ticket, isFlipped, onFlip, onTicketClick }) => {
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ko-KR', options);
  };

  return (
    <div className={`ticket-container ${isFlipped ? 'flipped' : ''}`} onClick={onFlip}>
      <div className="ticket-front">
        <img src={ticket.image} alt="Ticket" />
      </div>
      <div className="ticket-back">
        <div className="ticket-back-content">
          <div className="photo-placeholder-left">
            {/* 사진 공간 */}
          </div>
          <div className="details-right">
            <div className="date-info">
              <span>{formatDate(ticket.date)}</span>
            </div>
            <textarea
              className="text-area"
              placeholder="오늘 하루는 어땠나요?"
              value={ticket.text || ''}
              onChange={(e) => onTicketClick(ticket.id, e.target.value)}
              onClick={(e) => e.stopPropagation()} // Prevent flipping when typing
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const MyPage = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [flippedTickets, setFlippedTickets] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const staticTickets = [
      { id: 1, title: 'Ticket 1', date: new Date().toISOString(), image: '/images/ticket1.png', text: '' },
      { id: 2, title: 'Ticket 2', date: new Date().toISOString(), image: '/images/ticket2.png', text: '' },
      { id: 3, title: 'Ticket 3', date: new Date().toISOString(), image: '/images/ticket3.png', text: '' },
      { id: 4, title: 'Ticket 4', date: new Date().toISOString(), image: '/images/ticket4.png', text: '' },
      { id: 5, title: 'Ticket 5', date: new Date().toISOString(), image: '/images/ticket5.png', text: '' },
      { id: 6, title: 'Ticket 6', date: new Date().toISOString(), image: '/images/ticket6.png', text: '' },
    ];
    setTickets(staticTickets);
  }, []);

  const handleFlip = (ticketId) => {
    setFlippedTickets(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
    // After a short delay to allow the flip animation to start, open the modal
    setTimeout(() => {
      const ticket = tickets.find(t => t.id === ticketId);
      setSelectedTicket(ticket);
    }, 300);
  };

  const handleTextChange = (ticketId, newText) => {
    setTickets(prevTickets =>
        prevTickets.map(ticket =>
            ticket.id === ticketId ? { ...ticket, text: newText } : ticket
        )
    );
  };

  const closeModal = () => {
    setSelectedTicket(null);
    // Un-flip all tickets when the modal is closed
    setFlippedTickets({});
  };

  return (
    <div className="amusement-park-theme" style={{ minHeight: '100vh' }}>
      <header className="main-header">
        <h1>Zoooooom</h1>
        <div className="header-buttons">
          {userProfile && <span className="user-greeting">{userProfile.nickname || userProfile.name}님, 환영합니다!</span>}
          <button className="mypage-btn" onClick={() => navigate('/main')}>HOME</button>
        </div>
      </header>
      <main className="mypage-main-content">
        <div className="user-info">
          <h2>My page</h2>
          <p><strong>Name:</strong> John Doe</p>
          <p><strong>Email:</strong> john.doe@example.com</p>
        </div>
        <div className="tickets-section">
          <div className="tickets-header">
            <h2>My Tickets</h2>
            <div className="ticket-nav-buttons">
              <button>{'<'}</button>
              <button>{'>'}</button>
            </div>
          </div>
          <div className="tickets-grid">
            {tickets.map(ticket => (
              <Ticket
                key={ticket.id}
                ticket={ticket}
                isFlipped={!!flippedTickets[ticket.id]}
                onFlip={() => handleFlip(ticket.id)}
                onTicketClick={handleTextChange}
              />
            ))}
          </div>
        </div>
      </main>
      {selectedTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="ticket-back-content">
              <div className="photo-placeholder-left">
                {/* 사진 공간 */}
              </div>
              <div className="details-right">
                <div className="date-info">
                  <span>{new Date(selectedTicket.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <textarea
                  className="text-area"
                  placeholder="오늘 하루는 어땠나요?"
                  value={selectedTicket.text || ''}
                  onChange={(e) => handleTextChange(selectedTicket.id, e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
