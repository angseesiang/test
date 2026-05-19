import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

export type AppPage = 'dashboard' | 'assessments' | 'new-assessment' | 'users' | 'assessment-detail';

export function Sidebar({ currentPage, navigate }: { currentPage: AppPage; navigate: (page: AppPage) => void }) {
  const { user, signOut } = useAuth();

  const navItems: Array<{ page: AppPage; label: string; icon: string; adminOnly?: boolean }> = [
    { page: 'dashboard', label: 'Dashboard', icon: '▦' },
    { page: 'assessments', label: 'Assessments', icon: '▤' },
    { page: 'new-assessment', label: 'New Assessment', icon: '+' },
    { page: 'users', label: 'Users', icon: '♢', adminOnly: true }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebarTop">
        <Logo />
        <nav className="sidebarNav">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item) => (
              <button
                key={item.page}
                className={`navItem ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => navigate(item.page)}
              >
                <span className="navIcon">{item.icon}</span>
                {item.label}
              </button>
            ))}
        </nav>
      </div>

      <div className="sidebarUser">
        <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'U'}</div>
        <div className="sidebarUserText">
          <strong>{user?.name ?? 'User'}</strong>
          <span>{user?.role === 'admin' ? 'Admin' : 'User'}</span>
        </div>
        <button className="iconButton" onClick={signOut} title="Sign out">
          ⇱
        </button>
      </div>
    </aside>
  );
}
