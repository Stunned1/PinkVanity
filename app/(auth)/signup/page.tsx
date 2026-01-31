import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <AuthCard
      footer={{ text: 'Already have an account?', href: '/login', linkText: 'Sign in' }}
      subtitle="Create an account with username + password."
      title="Create account"
    >
      <SignupForm />
    </AuthCard>
  );
}

