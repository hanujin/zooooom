import AuthForm from '../components/AuthForm';
import { useNavigate } from 'react-router-dom';
import '../styles/Main.css';
import { API_BASE } from '../config';

function Signup() {
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    const formData = {
      email: e.target.email.value,
      password: e.target.password.value,
      passwordConfirm: e.target.passwordConfirm.value,
      name: e.target.name.value,
    };

    if (formData.password !== formData.passwordConfirm) {
      alert('Passwords do not match.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('✅ Account created — please log in.');
      navigate('/');
    } catch (err) {
      alert(err.message || 'Signup failed');
    }
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
