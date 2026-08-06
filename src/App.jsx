import { useState, useContext } from 'react';

import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

function App() {
  const { isAuthenticated, logoutUser } = useContext(AuthContext);
  
  const [authScreen, setAuthScreen] = useState('login');

  // ==========================================
  // RÈGLE 1 : SI L'UTILISATEUR EST CONNECTÉ
  // ==========================================
  if (isAuthenticated) {
    return (
      <Home/>
    );
  }

  // ==========================================
  // RÈGLE 2 : SI L'UTILISATEUR N'EST PAS CONNECTÉ
  // ==========================================
  if (authScreen === 'login') {
    return <Login onNavigateToRegister={() => setAuthScreen('register')} />;
  }

  return <Register onNavigateToLogin={() => setAuthScreen('login')} />;
}

export default App;