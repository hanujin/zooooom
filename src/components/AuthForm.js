function AuthForm({ type = 'login', onSubmit, onNavigateSignup, onNavigateLogin }) {
    return (
      <form onSubmit={onSubmit} className="auth-form-container">
        <div className="logo-container">
          <h2>{type === 'login' ? 'Login' : 'Signup'}</h2>
        </div>
        <input
          className="auth-input"
          type="email"
          name="email"
          placeholder="이메일을 입력하세요"
          required
        />
        <input
          className="auth-input"
          type="password"
          name="password"
          placeholder="비밀번호를 입력하세요"
          required
        />
        
        {type === 'signup' && (
          <>
            <input
              className="auth-input"
              type="password"
              name="passwordConfirm"
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
            <input
              className="auth-input"
              type="text"
              name="name"
              placeholder="이름을 입력하세요"
              required
            />
          </>
        )}
  
        <button className="primary-btn" type="submit">
          {type === 'login' ? '로그인' : '회원가입'}
        </button>
  
        {type === 'login' ? (
          <>
            <div className="divider"></div>
            <div className="footer-links">
              <a href="#signup" onClick={onNavigateSignup}>회원가입</a>
            </div>
          </>
        ) : (
          <>
            <div className="divider">  </div>
            <div className="footer-links">
              <a href="#login" onClick={onNavigateLogin}>로그인으로</a>
            </div>
          </>
        )}
      </form>
    );
  }
  
  export default AuthForm;
