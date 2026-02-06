import { useState, useEffect } from 'react';
import { LoginPage } from './LoginPage';
import { MainRoutePage } from './MainRoutePage';
import { DriverInfo } from '@/types/driver';
import { 
  authenticateDriver, 
  signOutDriver, 
  saveDriverSession, 
  clearDriverSession, 
  getSavedDriverSession 
} from '@/services/authService';

const Index = () => {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // true until auth state is checked

  const handleLogin = async (driverId: string, password: string) => {
    setIsLoading(true);
    setLoginError(undefined);

    try {
      // Authenticate and fetch driver data from Firestore
      const result = await authenticateDriver(driverId, password);
      
      if (result) {
        setDriver(result);
        saveDriverSession(result); // Save to localStorage for persistence
        
        // Request permissions after login (non-blocking, native dialogs)
        // Like delivery apps - ask but don't block if denied
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
          setTimeout(async () => {
            try {
              const { requestPermissionsDirect } = await import('@/utils/requestPermissionsDirect');
              await requestPermissionsDirect();
            } catch (permError) {
              // Silently fail - permissions will be requested when starting route
              console.log('Permission request after login skipped:', permError);
            }
          }, 1000); // Small delay so login completes first
        }
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
    clearDriverSession(); // Clear from localStorage
    setDriver(null);
    setLoginError(undefined);
  };

  // Restore session from localStorage on page load
  useEffect(() => {
    const savedDriver = getSavedDriverSession();
    if (savedDriver) {
      setDriver(savedDriver);
    }
    setIsRestoring(false);
  }, []);

  // Show loading while restoring session on page refresh
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
