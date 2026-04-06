'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ServiceSelector } from '@/components/service-selector';
import { VoiceForm } from '@/components/voice-form';
import { QRDisplay } from '@/components/qr-display';
import { AdminDashboard } from '@/components/admin-dashboard';
import { UserSidebar } from '@/components/user-sidebar';
import { LocationSelector } from '@/components/location-selector';
import { Menu, X, LogOut, User } from 'lucide-react';
import { useLanguage, AVAILABLE_LANGUAGES } from '@/contexts/LanguageContext';
import { translations } from '@/lib/translations';
import { getTranslatedService } from '@/lib/government-services';

interface MainPortalProps {
  userEmail: string;
  onLogout: () => void;
  onGoToProfile: () => void;
  language?: any;
  onLanguageChange?: (code: string) => void;
}

type View = 'home' | 'location-select' | 'form' | 'admin' | 'qr-display';

export function MainPortal({ userEmail, onLogout, onGoToProfile, language, onLanguageChange }: MainPortalProps) {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ state: string; district: string } | null>(null);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { selectedLanguage, setSelectedLanguage } = useLanguage();
  const t = translations[selectedLanguage?.code || 'en'];

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setCurrentView('location-select');
  };

  const handleLocationSelected = (state: string, district: string) => {
    setSelectedLocation({ state, district });
    setCurrentView('form');
  };

  const handleFormSubmit = (data: any) => {
    setSubmittedData(data);
    setCurrentView('qr-display');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedService(null);
    setSelectedLocation(null);
    setSubmittedData(null);
  };

  const handleBackToLocationSelect = () => {
    setCurrentView('location-select');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Navigation - Full Width */}
      <nav className="bg-black/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackToHome}>
              <img src="/logo.jpeg" alt="Logo" className="h-16 w-16 rounded-xl object-cover shadow-xl transition-transform hover:scale-105 active:scale-95" />
              <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Vaani Ai
              </span>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 bg-white/10 border border-white/20 rounded-xl text-white active:scale-90 transition-all"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="border-t border-slate-100 mt-6 pt-6 md:hidden space-y-6 animate-in slide-in-from-top-4 duration-500">
              <div className="px-2">
                <UserSidebar
                  userEmail={userEmail}
                  onLogout={onLogout}
                  onGoToProfile={onGoToProfile}
                  onViewForm={(sub) => {
                    setSubmittedData(sub);
                    setCurrentView('qr-display');
                    setMobileMenuOpen(false);
                  }}
                  language={language}
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Content Area */}
      <div className="flex-1 flex w-full relative">
        {/* Desktop Sidebar - Sticky under the 113px tall navbar */}
        <div className="hidden md:block shrink-0 sticky top-[113px] h-[calc(100vh-113px)] self-start border-white/10 relative z-40 bg-black transition-all duration-300 ease-in-out border-r overflow-y-auto no-scrollbar">
          <UserSidebar
            userEmail={userEmail}
            onLogout={onLogout}
            onGoToProfile={onGoToProfile}
            onViewForm={(sub) => {
              setSubmittedData(sub);
              setCurrentView('qr-display');
            }}
            language={language}
          />
        </div>

        {/* Main Content Area - This grows and scrolls freely with the page */}
        <div className="flex-1 w-full">


          {/* Main Content */}
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {currentView === 'home' && (
              <ServiceSelector
                onSelectService={handleServiceSelect}
                language={selectedLanguage?.voiceCode || 'en-IN'}
              />
            )}

            {currentView === 'location-select' && selectedService && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LocationSelector
                  serviceName={getTranslatedService(selectedService, selectedLanguage?.code || 'en').name}
                  onLocationSelected={handleLocationSelected}
                  onCancel={handleBackToHome}
                />
              </div>
            )}

            {currentView === 'form' && selectedService && selectedLocation && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <VoiceForm
                  service={selectedService}
                  language={selectedLanguage?.voiceCode || 'en-IN'}
                  selectedLocation={selectedLocation}
                  userEmail={userEmail}
                  onSubmit={handleFormSubmit}
                  onBack={handleBackToLocationSelect}
                />
              </div>
            )}

            {currentView === 'qr-display' && submittedData && (
              <div className="animate-in zoom-in-95 duration-500">
                <QRDisplay
                  submission={submittedData}
                  language={selectedLanguage?.voiceCode || 'en-IN'}
                  onNewApplication={handleBackToHome}
                />
              </div>
            )}

            {currentView === 'admin' && <AdminDashboard />}
          </main>
        </div>
      </div>
    </div>
  );
}
