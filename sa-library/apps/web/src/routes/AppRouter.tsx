import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute, RoleRoute } from './ProtectedRoute';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AuthPage } from '@/pages/AuthPage';
import { BookDetailPage } from '@/pages/BookDetailPage';
import { MyLibraryPage, MemberReservationsPage, MemberLoansPage } from '@/pages/MemberPages';
import {
  StaffDashboardPage,
  StaffReservationsPage,
  StaffLoansPage,
  StaffMembersPage,
} from '@/pages/StaffPages';
import { StaffCataloguePage } from '@/pages/StaffCataloguePage';
import { AdminPage, AdminLibrariesPage } from '@/pages/AdminPages';
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/books/:id" element={<BookDetailPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/my-library" element={<MyLibraryPage />} />
              <Route path="/my-library/reservations" element={<MemberReservationsPage />} />
              <Route path="/my-library/loans" element={<MemberLoansPage />} />
              <Route path="/my-library/history" element={<MemberLoansPage history />} />
              <Route
                element={<RoleRoute roles={['LIBRARIAN', 'LIBRARY_ADMIN', 'PLATFORM_ADMIN']} />}
              >
                <Route path="/staff" element={<StaffDashboardPage />} />
                <Route path="/staff/catalogue" element={<StaffCataloguePage />} />
                <Route path="/staff/reservations" element={<StaffReservationsPage />} />
                <Route path="/staff/loans" element={<StaffLoansPage />} />
                <Route path="/staff/members" element={<StaffMembersPage />} />
              </Route>
              <Route element={<RoleRoute roles={['PLATFORM_ADMIN']} />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/libraries" element={<AdminLibrariesPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
