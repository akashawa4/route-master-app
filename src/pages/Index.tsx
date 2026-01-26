import { useState, useEffect } from 'react';
import { LoginPage } from './LoginPage';
import { MainRoutePage } from './MainRoutePage';
import { DriverInfo } from '@/types/driver';
import { authenticateDriver, onAuthStateChange, signOutDriver } from '@/services/authService';

const Index = () => {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (driverId: string, password: string) => {
    setIsLoading(true);
    setLoginError(undefined);

    try {
      // Authenticate and fetch driver data from Firestore
      const result = await authenticateDriver(driverId, password);
      
      if (result) {
        setDriver(result);
      } else {
        setLoginError('Invalid Driver ID or Password. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutDriver();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setDriver(null);
    setLoginError(undefined);
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      if (!user) {
        // User signed out
        setDriver(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (driver) {
    return <MainRoutePage driver={driver} onLogout={handleLogout} />;
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      error={loginError}
      isLoading={isLoading}
    />
  );
};

export default Index;
