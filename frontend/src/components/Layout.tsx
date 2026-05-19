import { ReactNode } from 'react';
import { Sidebar, AppPage } from './Sidebar';

export function Layout({ currentPage, navigate, children }: { currentPage: AppPage; navigate: (page: AppPage) => void; children: ReactNode }) {
  return (
    <div className="appShell">
      <Sidebar currentPage={currentPage} navigate={navigate} />
      <main className="mainContent">{children}</main>
    </div>
  );
}
