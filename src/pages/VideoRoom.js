import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './../styles/VideoRoom.css';

// ParticipantView는 원격 참가자용으로 유지합니다.
const ParticipantView = ({ name }) => {
  return (
    <div className="participant-view">
      <video autoPlay playsInline className="video-feed"></video>
      <div className="participant-name">{name}</div>
    </div>
  );
};

function VideoRoom() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const [roomInfo, setRoomInfo] = useState({ name: '테스트 채팅방' });
  const [participants, setParticipants] = useState([
    { id: 'remote1', name: '참가자 1' },
  ]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [handLandmarker, setHandLandmarker] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [stickerPosition, setStickerPosition] = useState({ x: 50, y: 50 });
  const [stickerSize, setStickerSize] = useState(50);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lines, setLines] = useState([]);
  const [currentGestureText, setCurrentGestureText] = useState('제스처 없음');
  const lastGesture = useRef(null);
  const gestureTimeout = useRef(null);
  const exitTimeout = useRef(null); // 채팅방 나가기 타임아웃

  const toggleCamera = (status) => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getVideoTracks();
      if (tracks.length > 0) {
        tracks[0].enabled = status;
        setIsCameraOn(status);
        console.log(`카메라 ${status ? '켜짐' : '꺼짐'}`);
      }
    }
  };

  const toggleMic = () => {
    // 실제 오디오 스트림이 연결되면 마이크 음소거 로직 추가
    setIsMicOn(prev => !prev);
    console.log(`마이크 ${!isMicOn ? '켜짐' : '꺼짐'}`);
  };

  const changeVolume = (amount) => {
    setVolume(prev => {
      const newVolume = Math.max(0, Math.min(1, prev + amount));
      console.log(`볼륨: ${Math.round(newVolume * 100)}%`);
      // 실제 오디오 요소에 볼륨 적용 로직 추가
      return newVolume;
    });
  };

  const handleLeaveRoom = () => {
    navigate('/main');
  };

  return (
    <div className="video-room-container">
      <header className="room-header">
        <h2>{roomInfo ? roomInfo.name : '로딩 중...'}</h2>
      </header>
      <div className="main-content-wrapper">
        <div className="video-grid-main">
          {/* 로컬 사용자 뷰 */}
          <div className="participant-view local">
            <video ref={videoRef} autoPlay playsInline muted className="video-feed"></video>
            <canvas ref={canvasRef} className="output_canvas"></canvas>
            <div className="gesture-display">{currentGestureText}</div>
            {isCursorVisible && <div className="cursor" style={{ left: `${cursorPosition.x}px`, top: `${cursorPosition.y}px` }}></div>}
            <div 
              className="sticker" 
              style={{ 
                left: `${stickerPosition.x}px`, 
                top: `${stickerPosition.y}px`,
                width: `${stickerSize}px`,
                height: `${stickerSize}px`,
                fontSize: `${stickerSize * 0.8}px`
              }}
            >🎨</div>
            <div className="participant-name">나</div>
          </div>
          {/* 원격 참가자 뷰 */}
          {participants.map(p => (
            <ParticipantView key={p.id} name={p.name} />
          ))}
        </div>
        <div className="chat-panel">
          {/* ... 채팅 UI ... */}
        </div>
      </div>
      <div className="controls-bar">
        <div className="control-buttons">
          <button onClick={() => toggleCamera(!isCameraOn)}>
            {isCameraOn ? '📷' : '📸'}
          </button>
          <button onClick={toggleMic}>
            {isMicOn ? '🎤' : '🔇'}
          </button>
          <div className="volume-control">
            <span>🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>
          <button className="leave-btn" onClick={handleLeaveRoom}>🚪 나가기</button>
        </div>
      </div>

    </div>
  );
}

export default VideoRoom;
