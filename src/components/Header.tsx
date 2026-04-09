import type { User } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

type HeaderProps = {
  locale: Locale;
  user: User;
  onSignOut: () => void;
};

export function Header({ locale, user, onSignOut }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownElement = dropdownRef.current;
      if (dropdownElement && dropdownElement.contains(event.target as Node) === false) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="topbar" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h1>{t(locale, 'appTitle')}</h1>
        </div>

        <div className="profile-menu-container" ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            className="avatar-trigger"
            onClick={() => setIsDropdownOpen((prev) => (prev ? false : true))}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title={user.email || ''}
          >
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.1)' }}>
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {isDropdownOpen && (
            <div className="profile-dropdown" style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              backgroundColor: '#1c1c1e',
              border: '1px solid #2c2c2e',
              borderRadius: '14px',
              padding: '8px',
              minWidth: '180px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              zIndex: 1000
            }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #2c2c2e', marginBottom: '6px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t(locale, 'signedInAs')}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '500', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
              </div>
              <button
                className="dropdown-item signout-btn"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSignOut();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#ff453a',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '16px' }}>🚪</span> {t(locale, 'signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
