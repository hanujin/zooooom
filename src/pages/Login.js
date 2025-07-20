import AuthForm from '../components/AuthForm';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();

  const handleLogin = (formData) => {
    // Simulate login
    console.log('Login attempt with:', formData);
    localStorage.setItem('accessToken', 'dummy_token');
    navigate('/main');
  };

  return (
    <div className="login-card">
      <img src="/logo.png" alt="Zoooooom!" className="brand-logo" />
      <AuthForm
        type="login"
        onSubmit={handleLogin}
        onNavigateSignup={() => navigate('/signup')}
      />
    </div>
  );
}

export default Login;
