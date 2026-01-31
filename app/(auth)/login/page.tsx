import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <AuthCard
      footer={{ text: "Don't have an account?", href: '/signup', linkText: 'Create one' }}
      subtitle="Use a username and password to sign in."
      title="Sign in"
    >
      <LoginForm />
    </AuthCard>
  );
}

