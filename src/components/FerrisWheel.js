import React, { useEffect, useState } from 'react';
import '../styles/FerrisWheel.css';

const cabins = [
  'ferris1.png', 'ferris2.png', 'ferris3.png', 'ferris4.png',
  'ferris5.png', 'ferris6.png', 'ferris7.png', 'ferris8.png'
];

const FerrisWheel = () => {
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

  return (
    <div className="ferris-wheel-container">
      <div className="ferris-frame" />
      {cabins.map((img, i) => {
        const baseAngle = (360 / cabins.length) * i;
        const rad = (Math.PI / 180) * (angle + baseAngle);

        const x = centerX + radius * Math.cos(rad);
        const y = centerY + radius * Math.sin(rad);

        return (
          <div
            key={i}
            className="cabin"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${cabinSize}px`,
              height: `${cabinSize}px`,
              backgroundImage: `url('/images/${img}')`,
              transform: `translate(-50%, -50%)`
            }}
          />
        );
      })}
    </div>
  );
};

export default FerrisWheel;
