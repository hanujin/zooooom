import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RollerCoaster.css';

function RollerCoaster({ rooms }) {
  const navigate = useNavigate();

  const handleCarClick = (meetingCode) => {
    // 클릭 시 해당 방으로 입장하는 기능 (추후 구현 가능)
    // navigate(`/rooms/${meetingCode}`);
    console.log(`Entering room: ${meetingCode}`);
  };

  return (
    <div className="roller-coaster-container">
      <div className="coaster-cars-wrapper">
        {rooms.map((room, index) => (
          <div 
            key={room.id} 
            className="coaster-car"
            style={{ animationDelay: `${index * 4}s` }} // 각 차량의 애니메이션 시작 시간을 다르게 설정
            onClick={() => handleCarClick(room.id)} // room.id를 meetingCode로 가정
          >
            {room.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RollerCoaster;
