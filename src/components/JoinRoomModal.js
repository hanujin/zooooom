// src/components/JoinRoomModal.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/index';

function JoinRoomModal({ isOpen, onClose }) {
  const [meetingCode, setMeetingCode] = useState('');
  const [password, setPassword] = useState('');
  const [needsPw, setNeedsPw] = useState(false);  // <—
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const checkRoom = async () => {
    if (!meetingCode.trim()) return;
    try {
      setChecking(true);
      const { data } = await apiClient.get(`/rooms/by-code/${meetingCode}`);
      setNeedsPw(!data.isPublic);
    } catch (e) {
      alert('방을 찾을 수 없습니다.');
      setNeedsPw(false);
    } finally {
      setChecking(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await apiClient.post('/rooms/join', {
        meetingCode,
        password: needsPw ? password : undefined,
      });
      onClose();
      navigate(`/rooms/${meetingCode}`, {
       state: { role: 'participant', password: needsPw ? password : undefined },
      });
    } catch (err) {
      alert(err.response?.data || err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>기존 놀이기구 탑승</h2>
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label htmlFor="code">접속 코드</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                required
              />
              <button type="button" onClick={checkRoom} disabled={checking}>
                확인
              </button>
            </div>
          </div>

          {needsPw && (
            <div className="form-group">
              <label htmlFor="pw">비밀번호</label>
              <input
                type="password"
                id="pw"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" className="primary-btn">입장</button>
        </form>
      </div>
    </div>
  );
}

export default JoinRoomModal;
