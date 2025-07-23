import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './../styles/Main.css';
import CreateRoomModal from './../components/CreateRoomModal';
import JoinRoomModal from './../components/JoinRoomModal';
import FerrisWheel from './../components/FerrisWheel';
import RollerCoaster from './../components/RollerCoaster'; // RollerCoaster 컴포넌트 import

function Main() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
  }, [navigate]);

  const handleCreateRoom = () => setIsCreateOpen(true);
  const handleJoinRoom   = () => setIsJoinOpen(true);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    navigate('/');
  };

  // 임시데이터
  const rooms = [
    { id: 'room1', name: 'React 스터디', isPublic: true }, { id: 'room2', name: '개인 작업실', isPublic: false },
    { id: 'room3', name: '저녁 수다방', isPublic: true }, { id: 'room4', name: '코테 준비', isPublic: true },
    { id: 'room5', name: '비공개 회의', isPublic: false }, { id: 'room6', name: '영화 토론', isPublic: true },
    { id: 'room7', name: '음악 감상실', isPublic: true }, { id: 'room8', name: '요리 레시피', isPublic: true },
    { id: 'room9', name: '여행 계획', isPublic: true }, { id: 'room10', name: '팀 프로젝트', isPublic: false },
    { id: 'room11', name: '독서 모임', isPublic: true }, { id: 'room12', name: '개발 뉴스', isPublic: true }
  ];

  const publicRooms = rooms.filter(room => room.isPublic);
  const ferrisWheelRooms = publicRooms.slice(0, 8); // 관람차는 공개방 중 앞 8개를 전달
  const rollerCoasterRooms = publicRooms.slice(8, 14); // 롤러코스터는 공개방 중 다음 6개를 전달

  return (
    <>
      <div className="main-container amusement-park-theme">
        <header className="main-header">
          <h1>Zoooooom</h1>
          <div className="header-buttons">
            {userProfile && <span className="user-greeting">{userProfile.nickname || userProfile.name}님, 환영합니다!</span>}
            <button className="mypage-btn" onClick={() => navigate('/mypage')}>마이페이지</button>
          </div>
        </header>

        <main className="amusement-park-main">
          <div className="banner-container">
            <div className="banner-item" onClick={handleCreateRoom}>
              <img src="/images/banner2.png" alt="Create Room Banner" className="banner-image" />
              <div className="banner-text">새 놀이기구 탑승</div>
            </div>
            <div className="banner-item" onClick={handleJoinRoom}>
              <img src="/images/banner1.png" alt="Join Room Banner" className="banner-image" />
              <div className="banner-text">기존 놀이기구 탑승</div>
            </div>
          </div>
          <img src="/images/cave.png" alt="Cave" className="cave-image" />
          <FerrisWheel rooms={ferrisWheelRooms} />
          <RollerCoaster rooms={rollerCoasterRooms} />
        </main>
      </div>

      <CreateRoomModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />

      <JoinRoomModal 
        isOpen={isJoinOpen} 
        onClose={() => setIsJoinOpen(false)} 
      />
    </>
  );
}

export default Main;
