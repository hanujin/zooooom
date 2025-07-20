import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Main from '../pages/Main';
import VideoRoom from '../pages/VideoRoom';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/main" element={<Main />} />
        <Route path="/rooms/:meetingCode" element={<VideoRoom />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;
