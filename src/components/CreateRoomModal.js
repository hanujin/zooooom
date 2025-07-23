import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from './../api/index';

function CreateRoomModal({ isOpen, onClose }) {
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const sections = [3, 4, 3];
    let id = '';
    for (let i = 0; i < sections.length; i++) {
      for (let j = 0; j < sections[i]; j++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < sections.length - 1) {
        id += '-';
      }
    }
    return id;
  };

  useEffect(() => {
    if (isOpen) {
      setRoomId(generateRandomId());
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
   try {
     // POST to backend
     const body = {
       meetingCode: roomId,
       title,
       isPublic: !isPrivate,
       joinPassword: isPrivate ? password : undefined, // backend will hash
     };
     const { data } = await apiClient.post('/rooms', body);
     const dest = `/rooms/${data.meetingCode || roomId}`;
     navigate(dest, {
      state: { role: 'owner', password: isPrivate ? password : undefined },
    });
     onClose();
   } catch (err) {
     alert(err.response?.data || err.message);
   }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>새 페이스룸 만들기</h2>
        <div className="room-id-display">
          <span>방 ID:</span>
          <strong>{roomId}</strong>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
           <label>공개 여부</label>
           <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
             <label>
               <input
                 type="radio"
                 name="privacy"
                 value="public"
                 checked={!isPrivate}
                 onChange={() => setIsPrivate(false)}
               />
               공개
             </label>
             <label>
               <input
                 type="radio"
                 name="privacy"
                 value="private"
                 checked={isPrivate}
                 onChange={() => setIsPrivate(true)}
               />
               비공개
             </label>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="room-name">방 이름</label>
            <input type="text" id="room-name" value={title} onChange = {(e) => setTitle(e.target.value)} required />
          </div>
          {isPrivate && (
           <div className="form-group">
             <label htmlFor="room-password">비밀번호</label>
             <input
               type="password"
               id="room-password"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               required
             />
           </div>
         )}
          <button type="submit" className="primary-btn">만들기</button>
        </form>
      </div>
    </div>
  );
}

export default CreateRoomModal;
