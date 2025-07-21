import React from 'react';
import '../styles/Main.css'; // Main.css를 import
import '../styles/MyPage.css';

const MyPage = () => {
  return (
    <div className="mypage-container amusement-park-theme"> {/* amusement-park-theme 클래스 추가 */}
      <h1 style={{ color: '#4a4a4a', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>My Page</h1>
      <div className="user-info">
        <h2>User Information</h2>
        <p><strong>Name:</strong> John Doe</p>
        <p><strong>Email:</strong> john.doe@example.com</p>
      </div>
    </div>
  );
};

export default MyPage;
