'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mail, User, LogOut, Edit2, Save, X } from 'lucide-react';
import { translations } from '@/lib/translations';

interface ProfilePageProps {
  email: string;
  onLogout: () => void;
  language?: any;
}

export function ProfilePage({ email, onLogout, language }: ProfilePageProps) {
  const t = translations[language?.code || 'en'] || translations['en'];
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(localStorage.getItem(`profile_name_${email}`) || '');
  const [phone, setPhone] = useState(localStorage.getItem(`profile_phone_${email}`) || '');
  const [tempName, setTempName] = useState(name);
  const [tempPhone, setTempPhone] = useState(phone);

  const handleSaveProfile = () => {
    localStorage.setItem(`profile_name_${email}`, tempName);
    localStorage.setItem(`profile_phone_${email}`, tempPhone);
    setName(tempName);
    setPhone(tempPhone);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempName(name);
    setTempPhone(phone);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">{t.yourProfile}</h1>
          <Button
            onClick={onLogout}
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 bg-transparent"
          >
            <LogOut size={16} className="mr-2" />
            {t.logout}
          </Button>
        </div>

        <Card className="p-8 bg-black border border-neutral-800">
          <div className="space-y-6">
            {/* Profile Information */}

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{t.profileInfo}</h2>
                {!isEditing && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                    className="border-purple-500 text-purple-400 hover:bg-purple-900/30 bg-transparent"
                  >
                    <Edit2 size={14} className="mr-2" />
                    {t.edit}
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4 bg-neutral-900 p-6 rounded-lg border border-neutral-800">
                  <div>
                    <label className="text-sm font-semibold text-neutral-300 flex items-center gap-2 mb-2">
                      <User size={16} />
                      {t.nameLabel}
                    </label>
                    <Input
                      type="text"
                      placeholder={t.namePlaceholder}
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="bg-neutral-800 text-white border-2 border-neutral-700 placeholder:text-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-neutral-300 mb-2 block">
                      {t.phoneLabel}
                    </label>
                    <Input
                      type="tel"
                      placeholder={t.phonePlaceholder}
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value)}
                      className="bg-neutral-800 text-white border-2 border-neutral-700 placeholder:text-neutral-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveProfile}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90"
                    >
                      <Save size={16} className="mr-2" />
                      {t.saveChanges}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="flex-1 border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-800"
                    >
                      <X size={16} className="mr-2" />
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                    <p className="text-sm text-neutral-400 mb-1">{t.nameLabel}</p>
                    <p className="text-lg font-semibold text-white">
                      {name || t.notProvided}
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                    <p className="text-sm text-neutral-400 mb-1">{t.phoneLabel}</p>
                    <p className="text-lg font-semibold text-white">
                      {phone || t.notProvided}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="pt-6 border-t border-neutral-800">
              <p className="text-sm text-neutral-400 mb-4">{t.profileInfo}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                  <p className="text-xs text-neutral-400 mb-1">{t.accountStatus}</p>
                  <p className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{t.active}</p>
                </div>
                <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                  <p className="text-xs text-neutral-400 mb-1">{t.memberSince}</p>
                  <p className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{t.today}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
