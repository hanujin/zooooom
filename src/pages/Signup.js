import AuthForm from '../components/AuthForm';
import { useNavigate } from 'react-router-dom';
import '../styles/Main.css';

function Signup() {
  const navigate = useNavigate();

  const handleSignup = (formData) => {
    console.log('Signup attempt with:', formData);
    alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
    navigate('/');
  };

  return (
    <div className="login-card amusement-park-theme">
      <img src="/logo.png" alt="Zoooooom!" className="brand-logo" />
      <AuthForm
        type="signup"
        onSubmit={handleSignup}
        onNavigateLogin={() => navigate('/')}
      />
    </div>
  );
}

export default Signup;
