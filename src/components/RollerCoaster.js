import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RollerCoaster.css';

function RollerCoaster({ rooms }) {
  const navigate = useNavigate();
  const totalCars = 6; // 항상 6개의 차량을 렌더링

  const handleCarClick = (room) => {
    if (room) {
      // 클릭 시 해당 방으로 입장하는 기능 (추후 구현 가능)
      // navigate(`/rooms/${room.id}`);
      console.log(`Entering room: ${room.id}`);
    } else {
      console.log("This car is empty.");
      // 빈 차 클릭 시, 방 만들기 모달을 열 수도 있습니다.
    }
  };

  return (
    <div className="roller-coaster-container">
      <div className="coaster-cars-wrapper">
        {Array.from({ length: totalCars }).map((_, index) => {
          const room = rooms[index];
          return (
            <div 
              key={index} 
              className="coaster-car"
              style={{ animationDelay: `${index * 2.5}s` }} // 15s / 6cars
              onClick={() => handleCarClick(room)}
            >
              <div className="room-title">{room ? room.name : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RollerCoaster;
