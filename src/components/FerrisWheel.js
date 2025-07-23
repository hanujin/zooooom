import React, { useEffect, useState } from 'react';
import '../styles/FerrisWheel.css';

const cabinImages = [
  'ferris1.png', 'ferris2.png', 'ferris3.png', 'ferris4.png',
  'ferris5.png', 'ferris6.png', 'ferris7.png', 'ferris8.png'
];

const FerrisWheel = ({ rooms = [] }) => {
  const [angle, setAngle] = useState(0);
  const [cabinSize, setCabinSize] = useState(150);
  const centerX = 400;
  const centerY = 385;
  const radius = 265;

  useEffect(() => {
    const interval = setInterval(() => {
      setAngle(prev => (prev + 1) % 360);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const totalCabins = 8; // 항상 8개의 칸을 렌더링

  return (
    <div className="ferris-wheel-container">
      <div className="ferris-frame" />
      {Array.from({ length: totalCabins }).map((_, i) => {
        const room = rooms[i]; // 현재 인덱스에 해당하는 방 정보
        const baseAngle = (360 / totalCabins) * i;
        const rad = (Math.PI / 180) * (angle + baseAngle);

        const x = centerX + radius * Math.cos(rad);
        const y = centerY + radius * Math.sin(rad);
        const cabinImage = cabinImages[i % cabinImages.length];

        return (
          <div
            key={i}
            className="cabin"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${cabinSize}px`,
              height: `${cabinSize}px`,
              transform: `translate(-50%, -50%)`
            }}
          >
            <img src={`/images/${cabinImage}`} alt="cabin" className="cabin-image" />
            <div className="room-title">
              {room ? room.name : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FerrisWheel;
