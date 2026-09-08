import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, FileSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { LoginInputSchema, RegisterInputSchema, type LoginInput, type RegisterInput } from '@documind/shared';
import { useAuth } from '@/context/AuthContext';

interface AuthPageProps { mode: 'login' | 'register' }
type FormInput = RegisterInput;

export default function AuthPage({ mode }: AuthPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormInput>();
  const isRegister = mode === 'register';

  const onSubmit = handleSubmit(async (values) => {
    setServerError('');
    const schema = isRegister ? RegisterInputSchema : LoginInputSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'email' || field === 'password') setError(field, { message: issue.message });
      }
      return;
    }
    try {
      if (isRegister) await auth.register(parsed.data as RegisterInput);
      else await auth.login(parsed.data as LoginInput);
      navigate('/');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Authentication failed.');
    }
  });

  return (
    <main className="min-h-screen bg-canvas text-white lg:grid lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden p-14 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(109,40,217,0.30),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(196,181,253,0.36),transparent_35%)]" />
        <div className="relative flex items-center gap-3 text-xl font-semibold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white"><FileSearch size={21} /></span>DocuMind</div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-violet-200">A calmer way to study</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight">Read closely. Ask better questions.</h1>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><ShieldCheck className="mb-3 text-emerald-300" />Private, user-isolated documents</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Sparkles className="mb-3 text-violet-300" />Cited, streamed AI answers</div>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Powered by Supabase, Cloudinary, pgvector and Gemini</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12 text-ink">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-ink/10 bg-paper p-8 shadow-card">
          <div className="mb-8 lg:hidden"><span className="text-lg font-semibold">DocuMind</span></div>
          <h2 className="font-display text-3xl tracking-tight">{isRegister ? 'Create your workspace' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-ink-muted">{isRegister ? 'Upload a source, then turn it into understanding.' : 'Continue where your research left off.'}</p>
          <div className="mt-8 space-y-5">
            {isRegister && <label className="block text-sm font-medium">Name<input {...register('name')} autoComplete="name" className="field" placeholder="Your name" /><span className="field-error">{errors.name?.message}</span></label>}
            <label className="block text-sm font-medium">Email<input {...register('email')} type="email" autoComplete="email" className="field" placeholder="you@example.com" /><span className="field-error">{errors.email?.message}</span></label>
            <label className="block text-sm font-medium">
              Password
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} className="field pr-12" placeholder="••••••••" />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 mt-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <span className="field-error">{errors.password?.message}</span>
            </label>
          </div>
          {serverError && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p>}
          <button disabled={isSubmitting} className="mt-7 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">{isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          <p className="mt-6 text-center text-sm text-slate-500">{isRegister ? 'Already have an account?' : 'New to DocuMind?'} <Link className="font-semibold text-sky-700" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create one'}</Link></p>
        </form>
      </section>
    </main>
  );
}
