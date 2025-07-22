import AuthForm from '../components/AuthForm';
import { useNavigate } from 'react-router-dom';
import '../styles/Main.css';
import { API_BASE } from '../config';

function Login() {
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    const formData = {
      email: e.target.email.value,
      password: e.target.password.value,
    };

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(await res.text());
      
      const { accessToken } = await res.json();
      localStorage.setItem('token', accessToken);
      navigate('/main');
    } catch (err) {
      alert(err.message || 'Login failed. Please try again.');
    }      
  };

  return (
    <div className="login-card amusement-park-theme">
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
