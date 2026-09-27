import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { DataForm } from '@/components/common/UI';
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const register = mode === 'register';
  return (
    <section className="auth-panel panel">
      <p className="eyebrow">WELCOME TO SA LIBRARY</p>
      <h1>{register ? 'Your next chapter starts here.' : 'Welcome back.'}</h1>
      <p>
        {register
          ? 'Create your account to reserve books at participating branches.'
          : 'Sign in to manage your books, reservations and loans.'}
      </p>
      <DataForm
        key={mode}
        label={register ? 'Create account' : 'Sign in'}
        fields={[
          ...(register
            ? [
                { name: 'firstName', label: 'First name', required: true },
                { name: 'lastName', label: 'Last name', required: true },
              ]
            : []),
          { name: 'email', label: 'Email address', type: 'email', required: true },
          {
            name: 'password',
            label: register ? 'Password (10–72 characters)' : 'Password',
            type: 'password',
            required: true,
            minLength: register ? 10 : 1,
            maxLength: 72,
          },
        ]}
        submit={async (data) => {
          const user = await signIn(mode, data);
          const from = (location.state as { from?: string } | null)?.from;
          navigate(
            from?.startsWith('/') && !from.startsWith('//')
              ? from
              : user.role === 'MEMBER'
                ? '/my-library'
                : user.role === 'PLATFORM_ADMIN'
                  ? '/admin'
                  : '/staff',
            { replace: true },
          );
        }}
      />
      <p>
        {register ? 'Already have an account?' : 'New to the library?'}{' '}
        <Link to={register ? '/login' : '/register'}>
          {register ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
