import { createContext, useContext, useState } from 'react';
import { getUser, removeToken } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [notification, setNotification] = useState(null);

  const currentOrg = user?.org || null;

  function notify(message, type = 'success') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  function signOut() {
    removeToken();
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('dashboard');
  }

  return (
    <AppContext.Provider value={{
      user, setUser,
      currentOrg,
      currentPage, setCurrentPage,
      notification, notify,
      signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
