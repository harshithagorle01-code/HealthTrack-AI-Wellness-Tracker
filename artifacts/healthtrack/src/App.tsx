import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowRight, Bell, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Droplets,
  Dumbbell, FileText, Heart, Home, LogOut, Moon, Plus, Send,
  Settings, ShieldCheck, Sparkles, Sprout, Sun, Target, Trash2, TrendingUp, UserRound,
  Footprints, X, Pencil, Download, LockKeyhole, Waves, AlertCircle
} from 'lucide-react';
import {
  getGetAnalyticsSummaryQueryKey, getGetDailyInsightQueryKey, getExportUserDataQueryKey,
  getGetGoalsQueryKey, getGetMeQueryKey, getGetProfileQueryKey, getGetRecordsQueryKey,
  getGetTodayRecordQueryKey, getGetWeeklyDigestQueryKey, getGetRemindersQueryKey,
  useCreateGoal, useCreateReminder, useDeleteAccount, useDeleteGoal, useDeleteRecord,
  useDeleteReminder, useExportUserData, useGetAnalyticsSummary, useGetDailyInsight,
  useGetGoals, useGetMe, useGetProfile, useGetRecords, useGetReminders, useGetTodayRecord,
  useGetWeeklyDigest, useIncrementRecord, useLogin, useLogout, useRegister, useSaveRecord,
  useSendAiChat, useUpdateGoal, useUpdateProfile, useUpdateReminder
} from '@workspace/api-client-react';
import type {
  AnalyticsSummary, Goal, GoalInput, HealthRecord, HealthRecordInput, ProfileInput,
  ReminderInput, UserProfile
} from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 45_000, retry: 1, refetchOnWindowFocus: false } } });
const disclaimer = 'HealthTrack AI is for general wellness information only, not medical advice, diagnosis, or treatment.';
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n?: number | null, digits = 0) => Number.isFinite(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';

function Notice({ text, clear }: { text: string; clear: () => void }) {
  useEffect(() => { const t = window.setTimeout(clear, 3500); return () => window.clearTimeout(t); }, [text, clear]);
  return <div className="toast" role="status">{text}</div>;
}

function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <p className={`disclaimer ${compact ? 'compact' : ''}`} data-testid="text-health-disclaimer"><ShieldCheck size={14} />{disclaimer}</p>;
}

function Brand({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`brand ${dark ? 'brand-dark' : ''}`}><span className="brand-mark"><Sprout size={19} strokeWidth={2.1} /></span><span>wellnest<span className="brand-ai">AI</span></span></Link>;
}

const navItems = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/records', label: 'My records', icon: FileText },
  { href: '/analytics', label: 'Patterns', icon: TrendingUp },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/ai-assistant', label: 'Wellness guide', icon: Sparkles },
];

function Shell({ children, profile }: { children: ReactNode; profile?: UserProfile }) {
  const [path] = useLocation();
  const logout = useLogout();
  const qc = useQueryClient();
  const [, go] = useLocation();
  const [menu, setMenu] = useState(false);
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { qc.clear(); go('/login'); }, onError: () => go('/login') });
  return <div className="app-shell">
    <aside className="sidebar desktop-nav">
      <Brand />
      <div className="side-caption">YOUR RHYTHM</div>
      <nav>{navItems.map(item => <Link key={item.href} href={item.href} className={`nav-link ${path === item.href ? 'active' : ''}`} data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon size={18} strokeWidth={1.8} />{item.label}</Link>)}</nav>
      <div className="side-spacer" />
      <div className="side-note"><div className="note-sun"><Sun size={17} /></div><strong>Small steps count.</strong><span>Your health story is made one day at a time.</span></div>
      <Link href="/profile" className={`nav-link ${path === '/profile' ? 'active' : ''}`}><UserRound size={18} />Profile</Link>
      <Link href="/settings" className={`nav-link ${path === '/settings' ? 'active' : ''}`}><Settings size={18} />Settings</Link>
      <button className="account-chip" onClick={signOut} data-testid="button-sign-out"><span className="avatar">{profile?.name?.trim().charAt(0)?.toUpperCase() || 'Y'}</span><span className="account-label"><b>{profile?.name || 'Your space'}</b><small>Personal account</small></span><LogOut size={16} /></button>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-mobile"><Brand /></div><div className="topbar-date"><span className="status-dot" />A little better, at your pace</div><button className="icon-button" title="Profile menu" onClick={() => setMenu(v => !v)}><span className="avatar small">{profile?.name?.trim().charAt(0)?.toUpperCase() || 'Y'}</span><ChevronDown size={14} /></button>
        {menu && <div className="menu-pop"><Link href="/profile" onClick={() => setMenu(false)}>Your profile</Link><Link href="/settings" onClick={() => setMenu(false)}>Settings</Link><button onClick={signOut}>Sign out</button></div>}
      </header>
      <main className="content page-in">{children}</main>
      <footer className="app-footer"><Disclaimer compact /></footer>
    </div>
    <nav className="mobile-nav">{navItems.map(item => <Link key={item.href} href={item.href} className={`nav-link ${path === item.href ? 'active' : ''}`}><item.icon size={18} />{item.label}</Link>)}</nav>
  </div>;
}

function PageTitle({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1 className="serif">{title}</h1>{sub && <p>{sub}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

function Loading({ label = 'Gathering your latest notes…' }: { label?: string }) {
  return <div className="loading-card card"><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /><span>{label}</span></div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="empty-state card"><span className="empty-icon"><AlertCircle /></span><h3>We couldn’t load this just now</h3><p>{message}</p><button className="btn btn-soft" onClick={retry}>Try again</button></div>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const login = useLogin();
  const register = useRegister();
  const auth = isLogin ? login : register;
  const qc = useQueryClient();
  const [, go] = useLocation();
  const [error, setError] = useState('');
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const form = new FormData(e.currentTarget);
    const data = isLogin
      ? { email: String(form.get('email')), password: String(form.get('password')) }
      : { name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) };
    auth.mutate({ data } as never, { onSuccess: (res: any) => { qc.setQueryData(getGetMeQueryKey(), res.user); go(res.user?.onboardingComplete ? '/dashboard' : '/onboarding'); }, onError: e => setError(errorText(e)) });
  };
  return <div className="auth-page grain">
    <header className="public-header"><Brand /><Link href="/" className="small-link">Back to home</Link></header>
    <div className="auth-wrap">
      <div className="auth-art"><div className="auth-art-orb"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orb-core"><Heart size={38} /></div><span className="orbit-dot dot-a" /><span className="orbit-dot dot-b" /></div><div className="auth-art-copy"><span className="eyebrow">A softer way to track</span><h2 className="serif">Your wellbeing,<br />in the <i>whole picture.</i></h2><p>Notice what helps you feel like you. No streaks, no judgment—just thoughtful patterns.</p></div><div className="auth-art-bottom">A private space for your everyday health.</div></div>
      <div className="auth-form-side"><div className="auth-form">
        <div className="mobile-auth-brand"><Brand /></div><span className="eyebrow">{isLogin ? 'WELCOME BACK' : 'A GOOD PLACE TO BEGIN'}</span>
        <h1 className="serif">{isLogin ? 'Come on in.' : 'Let’s make room for you.'}</h1><p className="auth-sub">{isLogin ? 'Your health story is right where you left it.' : 'Start with the habits that make your days feel better.'}</p>
        <form onSubmit={submit} className="form-stack">
          {!isLogin && <label><span className="label">Your name</span><input className="field" name="name" autoComplete="name" required minLength={2} placeholder="How should we call you?" data-testid="input-name" /></label>}
          <label><span className="label">Email address</span><input className="field" type="email" name="email" required autoComplete="email" placeholder="you@example.com" data-testid="input-email" /></label>
          <label><span className="label">Password</span><input className="field" type="password" name="password" required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="At least 8 characters" data-testid="input-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={auth.isPending} data-testid="button-auth-submit">{auth.isPending ? 'One moment…' : isLogin ? 'Sign in' : 'Create my account'}<ArrowRight size={17} /></button>
        </form>
        <div className="auth-switch">{isLogin ? 'New to Wellnest?' : 'Already have a space?'} <Link href={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></div>
        <Disclaimer />
      </div></div>
    </div>
  </div>;
}

function Landing() {
  return <div className="landing grain">
    <header className="landing-nav wrap"><Brand /><nav><a href="#approach">Our approach</a><a href="#how">How it works</a><Link href="/login">Sign in</Link></nav><Link href="/register" className="btn btn-primary">Begin your story <ArrowRight size={16} /></Link></header>
    <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" />YOUR HEALTH, WITH ROOM TO BREATHE</div><h1 className="serif">Better days are<br />built <i>gently.</i></h1><p>Wellnest helps you notice the little things that shape how you feel—so you can care for yourself with more clarity and less pressure.</p><div className="hero-actions"><Link href="/register" className="btn btn-primary">Make a little space <ArrowRight size={17} /></Link><a className="text-link" href="#approach">See how it feels <ChevronRight size={16} /></a></div><div className="hero-proof"><div className="proof-leaves"><Sprout size={17} /></div><span>Made for real life, not perfect streaks.</span></div></div>
      <div className="hero-visual"><div className="visual-sun" /><div className="hero-leaf leaf-1" /><div className="hero-leaf leaf-2" /><div className="hero-card"><div className="hc-head"><span>YOUR TUESDAY, SO FAR</span><span className="hc-date">TODAY</span></div><div className="hc-greeting serif">A steady kind<br />of day.</div><div className="hc-score-row"><div className="score-ring"><span>76</span><small>feeling good</small></div><div className="hc-note"><span className="tiny-check"><Check size={13} /></span><span>You made time<br />to move today.</span></div></div><div className="hc-metrics"><div><span className="metric-glyph water"><Droplets size={15} /></span><span>Water</span><b>1.4 <small>/ 2.2 L</small></b><div className="progress-track"><div className="progress-fill" style={{ width: '64%' }} /></div></div><div><span className="metric-glyph steps"><Footprints size={15} /></span><span>Movement</span><b>6,240 <small>/ 8,000</small></b><div className="progress-track"><div className="progress-fill gold" style={{ width: '78%' }} /></div></div></div><div className="hc-foot"><span><span className="status-dot" />A few small wins add up.</span><span>01 / 03</span></div></div><div className="floating-note"><span className="spark-circle"><Sparkles size={16} /></span><span><b>A pattern worth noticing</b><small>Your sleep and mood are moving together.</small></span></div></div>
    </section>
    <section id="approach" className="approach-section"><div className="wrap approach-grid"><div><span className="eyebrow">A DIFFERENT KIND OF HEALTH TRACKER</span><h2 className="serif">Curiosity over<br /><i>correction.</i></h2></div><div className="approach-copy"><p>Good health isn’t a score you pass or fail. It’s the texture of your days: a walk that clears your head, a night that restores you, a glass of water when you remember.</p><p>Wellnest brings those moments together, so you can understand your own rhythms—and choose what feels right next.</p><Link href="/register" className="under-link">Get to know your patterns <ArrowRight size={15} /></Link></div></div></section>
    <section id="how" className="feature-section wrap"><div className="feature-heading"><div><span className="eyebrow">YOUR HEALTH, IN CONTEXT</span><h2 className="serif">A daily practice<br />that <i>fits you.</i></h2></div><p>No complicated setup. Start with a few things you care about, then let understanding grow over time.</p></div><div className="feature-list"><article><span className="feature-num">01</span><div className="feature-icon peach"><Droplets /></div><div><h3>Notice the everyday</h3><p>Keep a light touch on hydration, rest, movement, meals, and mood. Log what matters to you.</p></div><ArrowRight className="feature-arrow" size={18} /></article><article><span className="feature-num">02</span><div className="feature-icon sage"><TrendingUp /></div><div><h3>See the shape of things</h3><p>Gentle trends make it easier to spot the habits that help you feel more like yourself.</p></div><ArrowRight className="feature-arrow" size={18} /></article><article><span className="feature-num">03</span><div className="feature-icon butter"><Sparkles /></div><div><h3>Find a kind next step</h3><p>Your wellness guide reflects on your own logs with practical, low-pressure ideas.</p></div><ArrowRight className="feature-arrow" size={18} /></article></div></section>
    <section className="quote-section"><div className="wrap quote-inner"><span className="quote-mark">“</span><blockquote className="serif">The goal isn’t to become someone else.<br />It’s to understand what helps <i>you.</i></blockquote><div className="quote-rule" /><span className="eyebrow">WELLNESS THAT MEETS YOU WHERE YOU ARE</span></div></section>
    <section className="closing wrap"><div className="closing-leaf"><Sprout size={23} /></div><div><span className="eyebrow">A SMALL BEGINNING IS STILL A BEGINNING</span><h2 className="serif">Start wherever you are.</h2><p>Two minutes to set up. A little more clarity, every day after.</p></div><Link href="/register" className="btn btn-primary">Create your space <ArrowRight size={16} /></Link></section>
    <footer className="landing-footer wrap"><Brand /><p>Private, personal wellness tracking.</p><Disclaimer compact /><span>© Wellnest AI</span></footer>
  </div>;
}

function Onboarding({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const [, go] = useLocation();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProfileInput>({
    name: profile.name || '', age: profile.age ?? null, gender: profile.gender || 'prefer_not_to_say',
    heightCm: profile.heightCm, weightKg: profile.weightKg, activityLevel: profile.activityLevel || 'moderate',
    themePreference: profile.themePreference || 'light', waterGoalMl: profile.goals?.waterMl || 2200,
    stepsGoal: profile.goals?.steps || 8000, exerciseGoalMinutes: profile.goals?.exerciseMinutes || 30,
    sleepGoalHours: profile.goals?.sleepHours || 8,
  });
  const change = (key: keyof ProfileInput, value: string) => setForm(f => ({ ...f, [key]: ['age','heightCm','weightKg','waterGoalMl','stepsGoal','exerciseGoalMinutes','sleepGoalHours'].includes(key) ? (value === '' ? null : Number(value)) : value } as ProfileInput));
  const save = () => { setError(''); update.mutate({ data: form }, { onSuccess: p => { qc.setQueryData(getGetProfileQueryKey(), p); qc.setQueryData(getGetMeQueryKey(), p); go('/dashboard'); }, onError: e => setError(errorText(e)) }); };
  return <div className="onboard-page grain"><header className="public-header"><Brand /><span className="quiet-label">YOUR SPACE, YOUR PACE</span></header><div className="onboard-wrap"><div className="onboard-progress"><span className={step === 0 ? 'current' : 'done'}>01</span><i /><span className={step === 1 ? 'current' : ''}>02</span><i /><span className={step === 2 ? 'current' : ''}>03</span></div>
    <div className="onboard-body page-in"><div className="onboard-side"><span className="eyebrow">A GOOD START</span><h1 className="serif">{['First, a little about you.','What feels good to focus on?','A rhythm that’s yours.'][step]}</h1><p>{['Your health is personal. Your space should be, too.','Set a few gentle daily intentions. You can always change these later.','Choose a pace that fits the life you have right now.'][step]}</p><div className="onboard-illustration"><div className="o-circle"><Heart size={31} /></div><span className="o-orbit o1" /><span className="o-orbit o2" /><span className="o-star" /></div></div>
      <div className="onboard-form card">{step === 0 ? <div className="form-stack">
        <label><span className="label">Name</span><input className="field" value={form.name} onChange={e => change('name', e.target.value)} data-testid="input-profile-name" /></label>
        <div className="two-fields"><label><span className="label">Age</span><input className="field" type="number" min="10" max="120" placeholder="Optional" value={form.age ?? ''} onChange={e => change('age', e.target.value)} /></label><label><span className="label">Gender</span><select className="field" value={form.gender} onChange={e => change('gender', e.target.value)}><option value="prefer_not_to_say">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non_binary">Non-binary</option><option value="self_describe">Self describe</option></select></label></div>
        <div className="two-fields"><label><span className="label">Height (cm)</span><input className="field" type="number" min="1" placeholder="Optional" value={form.heightCm ?? ''} onChange={e => change('heightCm', e.target.value)} /></label><label><span className="label">Weight (kg)</span><input className="field" type="number" min="1" step=".1" placeholder="Optional" value={form.weightKg ?? ''} onChange={e => change('weightKg', e.target.value)} /></label></div>
        <label><span className="label">Usual activity</span><select className="field" value={form.activityLevel} onChange={e => change('activityLevel', e.target.value)}><option value="sedentary">Mostly sitting</option><option value="light">A little movement</option><option value="moderate">A balanced mix</option><option value="active">Quite active</option><option value="very_active">Very active most days</option></select></label>
      </div> : step === 1 ? <div className="form-stack"><TargetInput label="Water" unit="ml / day" value={form.waterGoalMl} onChange={v => change('waterGoalMl', v)} /><TargetInput label="Steps" unit="steps / day" value={form.stepsGoal} onChange={v => change('stepsGoal', v)} /><TargetInput label="Movement" unit="minutes / day" value={form.exerciseGoalMinutes} onChange={v => change('exerciseGoalMinutes', v)} /><TargetInput label="Sleep" unit="hours / night" value={form.sleepGoalHours} onChange={v => change('sleepGoalHours', v)} /></div> : <div className="welcome-step"><span className="welcome-icon"><Sprout size={32} /></span><h2 className="serif">This is a beginning,<br />not a test.</h2><p>Your goals can shift as your life does. We’ll help you notice what works, without keeping score of your worth.</p><div className="welcome-facts"><span><CheckCircle2 size={16} />You’re in control</span><span><ShieldCheck size={16} />Your data stays personal</span></div></div>}
        {error && <p className="form-error">{error}</p>}<div className="onboard-actions">{step > 0 && <button className="btn btn-soft" onClick={() => setStep(s => s - 1)}><ChevronLeft size={16} />Back</button>}{step < 2 ? <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>Continue <ArrowRight size={16} /></button> : <button className="btn btn-primary" onClick={save} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Step into your space'} <ArrowRight size={16} /></button>}</div>
      </div></div><footer className="onboard-footer"><Disclaimer compact /></footer></div></div>;
}

function TargetInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: string) => void }) {
  return <label className="target-input"><span><b>{label}</b><small>{unit}</small></span><input className="field" type="number" value={value} min="1" onChange={e => onChange(e.target.value)} /></label>;
}

function MetricTile({ label, value, unit, goal, icon: Icon, color, onAdd, increment }: { label: string; value: number; unit: string; goal: number; icon: typeof Droplets; color: string; onAdd?: () => void; increment?: string }) {
  return <div className="metric-card card"><div className="metric-top"><span className={`metric-icon ${color}`}><Icon size={18} /></span>{onAdd && <button onClick={onAdd} className="add-round" aria-label={`Add ${label}`} title={`Add ${label}`}><Plus size={16} /></button>}</div><div className="metric-label">{label}</div><div className="metric-value">{fmt(value)}<small> {unit}</small></div><div className="metric-meta"><span>{fmt(goal)} {unit} goal</span><b>{Math.round(pct)}%</b></div><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>{increment && <span className="metric-hint">+{increment} with one tap</span>}</div>;
}

function Dashboard({ profile }: { profile: UserProfile }) {
  const today = useGetTodayRecord({ query: { queryKey: getGetTodayRecordQueryKey() } });
  const insight = useGetDailyInsight({ query: { queryKey: getGetDailyInsightQueryKey() } });
  const weekStartDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }, []);
  const weekParams = useMemo(() => ({ startDate: weekStartDate, endDate: todayISO(), limit: 7 }), [weekStartDate]);
  const week = useGetRecords(weekParams, { query: { queryKey: getGetRecordsQueryKey(weekParams) } });
  const inc = useIncrementRecord();
  const qc = useQueryClient();
  const [toast, setToast] = useState('');
  const record = today.data;
  const add = (metric: 'waterMl' | 'steps' | 'exerciseMinutes', delta: number, label: string) => inc.mutate({ data: { metric, delta } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetTodayRecordQueryKey() }); qc.invalidateQueries({ queryKey: getGetRecordsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDailyInsightQueryKey() }); qc.invalidateQueries({ queryKey: getGetWeeklyDigestQueryKey() }); setToast(`${label} added to today`); }, onError: e => setToast(errorText(e)) });
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <><PageTitle eyebrow={date.toUpperCase()} title={`A good day to begin, ${profile.name?.split(' ')[0] || 'friend'}.`} sub="Take a breath. Here’s how your day is taking shape." action={<Link href="/records" className="btn btn-soft"><CalendarDays size={16} />Daily record</Link>} />
    {today.isLoading ? <Loading /> : today.isError ? <ErrorState message={errorText(today.error)} retry={() => today.refetch()} /> : <>
    <section className="dash-hero card"><div className="dash-hero-copy"><span className="hero-kicker"><span className="status-dot" />TODAY’S CHECK-IN</span><h2 className="serif">{record?.wellnessScore ? 'You’re finding your rhythm.' : 'There’s no wrong way to start.'}</h2><p>{record?.wellnessScore ? 'A little progress is still progress. Your day is unfolding.' : 'Log something small. Your health story starts with what you notice.'}</p><Link href="/records" className="dash-hero-link">Add a note about today <ArrowRight size={15} /></Link></div><div className="wellness-score"><div className="score-chart" style={{ '--score': `${Math.min(100, record?.wellnessScore ?? 0)}%` } as CSSProperties}><span>{record?.wellnessScore ?? '—'}</span><small>wellness</small></div></div><div className="hero-decoration"><div /><div /><div /></div></section>
    <section className="metric-grid">
      <MetricTile label="Water" value={record?.waterMl ?? 0} unit="ml" goal={profile.goals?.waterMl ?? 2200} icon={Droplets} color="mint" onAdd={() => add('waterMl', 250, '250 ml of water')} increment="250 ml" />
      <MetricTile label="Steps" value={record?.steps ?? 0} unit="steps" goal={profile.goals?.steps ?? 8000} icon={Footprints} color="peach" onAdd={() => add('steps', 500, '500 steps')} increment="500 steps" />
      <MetricTile label="Movement" value={record?.exerciseMinutes ?? 0} unit="min" goal={profile.goals?.exerciseMinutes ?? 30} icon={Dumbbell} color="lilac" onAdd={() => add('exerciseMinutes', 10, '10 movement minutes')} increment="10 min" />
      <MetricTile label="Sleep" value={record?.sleepHours ?? 0} unit="hrs" goal={profile.goals?.sleepHours ?? 8} icon={Moon} color="butter" />
    </section>
    <section className="dashboard-lower"><div className="card insight-card"><div className="section-head"><div><span className="eyebrow">A GENTLE OBSERVATION</span><h3 className="serif">A thought for today</h3></div><Sparkles size={19} /></div>{insight.isLoading ? <div className="skeleton-line wide" /> : insight.data ? <><p className="insight-headline">{insight.data.headline}</p><p>{insight.data.encouragement}</p>{insight.data.insights?.[0] && <div className="micro-action"><span className="micro-dot" /><span><b>A tiny next step</b><small>{insight.data.insights[0].microAction}</small></span></div>}</> : <p>As your days fill in, gentle patterns will start to appear here.</p>}<Disclaimer compact /></div>
      <div className="card week-card"><div className="section-head"><div><span className="eyebrow">YOUR WEEK, IN MOMENTS</span><h3 className="serif">A little at a time.</h3></div><Link href="/analytics" className="circle-arrow"><ArrowRight size={16} /></Link></div><WeekDots records={week.data || []} /><p>{week.data?.length ? `${week.data.length} day${week.data.length === 1 ? '' : 's'} with a note this week. Every one counts.` : 'Each day is a fresh page. Come back to see the rhythm taking shape.'}</p><Link href="/analytics" className="text-link">Explore your patterns <ArrowRight size={15} /></Link></div></section>
    </>}
    {toast && <Notice text={toast} clear={() => setToast('')} />}
  </>;
}

function WeekDots({ records }: { records: HealthRecord[] }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
  return <div className="week-dots">{days.map((d, i) => { const rec = records.find(r => r.date?.slice(0, 10) === d.toISOString().slice(0, 10)); return <div className="week-day" key={i}><span className={`day-dot ${rec ? 'has-record' : i === 6 ? 'today-dot' : ''}`}><span>{rec ? <Check size={13} /> : ''}</span></span><small>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>; })}</div>;
}

function RecordsPage() {
  const [range, setRange] = useState(30);
  const start = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - range); return d.toISOString().slice(0, 10); }, [range]);
  const params = { startDate: start, endDate: todayISO(), limit: 100 };
  const records = useGetRecords(params, { query: { queryKey: getGetRecordsQueryKey(params) } });
  const remove = useDeleteRecord();
  const save = useSaveRecord();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<HealthRecord | null>(null);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');
  const filtered = (records.data || []).filter(r => !filter || r.date?.startsWith(filter));
  const deleteRecord = (id: string) => { if (!window.confirm('Delete this daily record? This can’t be undone.')) return; remove.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetRecordsQueryKey() }); qc.invalidateQueries({ queryKey: getGetTodayRecordQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDailyInsightQueryKey() }); qc.invalidateQueries({ queryKey: getGetWeeklyDigestQueryKey() }); setToast('Daily record removed'); }, onError: e => setToast(errorText(e)) }); };
  const saveEdit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!edit) return; const fd = new FormData(e.currentTarget); const data: HealthRecordInput = { date: edit.date.slice(0, 10), waterMl: Number(fd.get('waterMl')), steps: Number(fd.get('steps')), exerciseMinutes: Number(fd.get('exerciseMinutes')), sleepHours: Number(fd.get('sleepHours')), caloriesConsumed: edit.caloriesConsumed || 0, notes: String(fd.get('notes') || '') }; save.mutate({ data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetRecordsQueryKey() }); qc.invalidateQueries({ queryKey: getGetTodayRecordQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDailyInsightQueryKey() }); qc.invalidateQueries({ queryKey: getGetWeeklyDigestQueryKey() }); setEdit(null); setToast('Your record was updated'); }, onError: e => setToast(errorText(e)) }); };
  return <><PageTitle eyebrow="YOUR HISTORY" title="The days you’ve noticed." sub="A record of small moments, not a scorecard." action={<label className="range-select"><CalendarDays size={16} /><select value={range} onChange={e => setRange(Number(e.target.value))}><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="90">Past 90 days</option></select></label>} />
    <div className="records-toolbar"><div><span className="record-count">{records.data?.length ?? 0}</span><span>days captured</span></div><label className="date-filter"><span>Jump to date</span><input className="field" type="date" value={filter} onChange={e => setFilter(e.target.value)} /></label></div>
    {records.isLoading ? <Loading /> : records.isError ? <ErrorState message={errorText(records.error)} retry={() => records.refetch()} /> : filtered.length ? <div className="records-list">{filtered.map(r => <article className="record-row card" key={r.id} data-testid={`record-row-${r.id}`}><div className="record-date"><span>{new Date(`${r.date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span><b>{new Date(`${r.date.slice(0,10)}T12:00:00`).getDate()}</b><small>{new Date(`${r.date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</small></div><div className="record-summary"><div><b>{r.wellnessScore ? `Wellness ${r.wellnessScore}` : 'A day in your story'}</b><small>{r.notes || 'A little more of your day, kept here.'}</small></div><div className="record-pills"><span><Droplets size={14} />{fmt(r.waterMl)} ml</span><span><Footprints size={14} />{fmt(r.steps)}</span><span><Moon size={14} />{fmt(r.sleepHours, 1)} h</span></div></div><div className="record-actions"><button className="icon-button" title="Edit record" onClick={() => setEdit(r)}><Pencil size={16} /></button><button className="icon-button danger-icon" title="Delete record" onClick={() => deleteRecord(r.id)} disabled={remove.isPending}><Trash2 size={16} /></button></div></article>)}</div> : <div className="empty-state card"><span className="empty-icon"><FileText /></span><h3>No days in this view yet</h3><p>Every record begins with noticing. Add today’s first detail from your daily check-in.</p><Link href="/dashboard" className="btn btn-primary">Go to today <ArrowRight size={16} /></Link></div>}
    {edit && <div className="modal-backdrop" role="presentation" onClick={() => setEdit(null)}><div className="modal-card card" role="dialog" aria-modal onClick={e => e.stopPropagation()}><button className="modal-close icon-button" onClick={() => setEdit(null)}><X size={18} /></button><span className="eyebrow">A DAY IN YOUR STORY</span><h2 className="serif">Edit your record</h2><p>{new Date(`${edit.date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'full' })}</p><form onSubmit={saveEdit} className="form-stack"><div className="two-fields">{(['waterMl','steps','exerciseMinutes','sleepHours'] as const).map(k => <label key={k}><span className="label">{({waterMl:'Water (ml)',steps:'Steps',exerciseMinutes:'Movement (min)',sleepHours:'Sleep (hrs)'} as const)[k]}</span><input className="field" name={k} type="number" min="0" step={k === 'sleepHours' ? '.1' : '1'} defaultValue={edit[k]} /></label>)}</div><label><span className="label">A note to remember</span><textarea className="field" name="notes" rows={3} defaultValue={edit.notes || ''} /></label><button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'} <Check size={16} /></button></form></div></div>}
    {toast && <Notice text={toast} clear={() => setToast('')} />}
  </>;
}

function AnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const analytics = useGetAnalyticsSummary({ range }, { query: { queryKey: getGetAnalyticsSummaryQueryKey({ range }) } });
  const summary: AnalyticsSummary | undefined = analytics.data;
  const keys = ['waterMl','steps','exerciseMinutes','sleepHours'] as const;
  const labels = ['Water','Steps','Movement','Sleep'];
  const vals = summary?.records || [];
  return <><PageTitle eyebrow="YOUR PATTERNS" title="Notice what’s changing." sub="Trends are invitations to be curious, never a grade." action={<div className="segmented">{(['7d','30d','90d'] as const).map(r => <button key={r} className={range === r ? 'selected' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>} />
    {analytics.isLoading ? <Loading /> : analytics.isError ? <ErrorState message={errorText(analytics.error)} retry={() => analytics.refetch()} /> : <><section className="analytics-overview"><div className="card avg-card"><span className="eyebrow">WELLNESS, ON AVERAGE</span><div className="avg-score serif">{fmt(summary?.wellnessAverage)}<small> / 100</small></div><p>Across {summary?.records?.length || 0} recorded days</p><div className="avg-mark"><Heart size={17} /> {summary?.completionRate ? `${Math.round(summary.completionRate)}% of your days recorded` : 'Your pace is yours'}</div></div><div className="card chart-card"><div className="section-head"><div><span className="eyebrow">WELLNESS RHYTHM</span><h3 className="serif">The shape of your days</h3></div><span className="chart-legend"><i />Wellness score</span></div>{vals.length ? <TrendChart records={vals} /> : <div className="chart-empty"><Activity size={23} /><span>Your first few logs will bring this chart to life.</span></div>}</div></section>
      <section className="trend-metrics">{keys.map((k,i) => <div className="trend-card card" key={k}><div className={`metric-icon ${['mint','peach','lilac','butter'][i]}`}><Activity size={17} /></div><span>{labels[i]} average</span><b>{fmt(summary?.averages?.[k], k === 'sleepHours' ? 1 : 0)}<small> {k === 'waterMl' ? 'ml' : k === 'steps' ? 'steps' : k === 'exerciseMinutes' ? 'min' : 'hrs'}</small></b><MiniSpark records={vals} metric={k} /></div>)}</section>
      <div className="analytics-note card"><Sparkles size={18} /><span>Patterns are personal. Averages can help you reflect, but they don’t tell the whole story.</span></div>
    </>}
  </>;
}

function TrendChart({ records }: { records: HealthRecord[] }) {
  const list = [...records].sort((a,b) => a.date.localeCompare(b.date)).slice(-14);
  const points = list.map((r,i) => `${list.length === 1 ? 50 : 26 + i*(548/(list.length-1))},${162 - Math.min(100, Math.max(0,r.wellnessScore || 0))*1.25}`);
  return <div className="trend-chart"><div className="chart-axis"><span>100</span><span>50</span><span>0</span></div><svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Wellness score trend"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7da88b" stopOpacity=".25"/><stop offset="1" stopColor="#7da88b" stopOpacity="0"/></linearGradient></defs><path d={`M ${points.join(' L ')} L ${points.length ? points[points.length-1].split(',')[0] : 574} 170 L 26 170 Z`} fill="url(#area)" /><polyline points={points.join(' ')} fill="none" stroke="#477e68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((pt,i) => { const [cx,cy]=pt.split(','); return <circle key={i} cx={cx} cy={cy} r="4" fill="#f8f5ea" stroke="#477e68" strokeWidth="2" />; })}<g stroke="#e6e9dd" strokeDasharray="3 5"><path d="M26 37H574"/><path d="M26 99H574"/><path d="M26 162H574"/></g></svg><div className="chart-dates">{[list[0],list[Math.floor((list.length-1)/2)],list[list.length-1]].filter(Boolean).map((r,i)=><span key={i}>{new Date(`${r!.date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>)}</div></div>;
}
function MiniSpark({ records, metric }: { records: HealthRecord[]; metric: 'waterMl'|'steps'|'exerciseMinutes'|'sleepHours' }) {
  const points = records.slice(-8).map((r,i) => `${i*12},${30 - Math.min(100, (r[metric] || 0)/(metric==='waterMl'?2500:metric==='steps'?10000:metric==='exerciseMinutes'?60:10)*100)*.25}`).join(' ');
  return <svg className="mini-spark" viewBox="0 0 84 34" aria-hidden="true"><polyline points={points || '0,25 12,20 24,22 36,16 48,19 60,11 72,13 84,8'} fill="none" stroke="#7a9c83" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function GoalsPage() {
  const query = useGetGoals({ query: { queryKey: getGetGoalsQueryKey() } });
  const create = useCreateGoal(); const update = useUpdateGoal(); const remove = useDeleteGoal(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [toast, setToast] = useState('');
  const [type, setType] = useState<GoalInput['goalType']>('steps');
  const [target, setTarget] = useState('8000');
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetGoalsQueryKey() });
  const createGoal = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: { goalType: type, targetValue: Number(target), startDate: todayISO() } }, { onSuccess: () => { invalidate(); setOpen(false); setToast('A new intention is set'); }, onError: e => setToast(errorText(e)) }); };
  const goalNames: Record<string,string> = { water_ml:'Drink water',steps:'Move through steps',exercise_min:'Make time to move',sleep_hrs:'Make space for sleep',weight_kg:'Weight intention',calories_kcal:'Nutrition intention' };
  const units: Record<string,string> = {water_ml:'ml',steps:'steps',exercise_min:'min',sleep_hrs:'hours',weight_kg:'kg',calories_kcal:'kcal'};
  const mark = (g:Goal,status:'completed'|'abandoned'|'active') => update.mutate({ id:g.id, data:{status,endDate:status==='active'?null:todayISO()} }, { onSuccess: () => { invalidate(); setToast(status === 'completed' ? 'Intention celebrated' : status === 'abandoned' ? 'Intention gently set aside' : 'Intention is active again'); }, onError:e=>setToast(errorText(e)) });
  const del = (g:Goal) => { if (!window.confirm('Remove this intention?')) return; remove.mutate({id:g.id},{onSuccess:()=>{invalidate();setToast('Intention removed')},onError:e=>setToast(errorText(e))}); };
  return <><PageTitle eyebrow="INTENTIONS, NOT PRESSURE" title="Goals that feel like yours." sub="Make space for what you want more of. Change direction whenever you need." action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={17} />New goal</button>} />
    {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={errorText(query.error)} retry={()=>query.refetch()} /> : query.data?.length ? <div className="goals-list">{query.data.map(g=>{const p=Math.min(100,g.targetValue?g.currentValue/g.targetValue*100:0);return <article className={`goal-card card ${g.status}`} key={g.id}><div className="goal-icon"><Target size={20}/></div><div className="goal-main"><div className="goal-titleline"><h3>{goalNames[g.goalType]||g.goalType}</h3><span className={`status-badge ${g.status}`}>{g.status}</span></div><p>{fmt(g.currentValue)} of {fmt(g.targetValue)} {units[g.goalType]||''}</p><div className="progress-track"><div className="progress-fill" style={{width:`${p}%`}}/></div><small>{Math.round(p)}% of the way there · started {new Date(`${g.startDate.slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></div><div className="goal-actions">{g.status==='active' ? <button className="btn btn-soft small-btn" onClick={()=>mark(g,'completed')}><Check size={15}/>Celebrate</button> : <button className="btn btn-soft small-btn" onClick={()=>mark(g,'active')}>Reactivate</button>}<button className="icon-button" title="Delete goal" onClick={()=>del(g)}><Trash2 size={16}/></button></div></article>})}</div> : <div className="empty-state card"><span className="empty-icon"><Target/></span><h3>Nothing you need to chase</h3><p>When you’re ready, set a kind intention for something you’d like to make room for.</p><button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={16}/>Set an intention</button></div>}
    <div className="kind-reminder"><Sprout size={18}/><span>Goals are here to support you. They never define how well you’re doing.</span></div>
    {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal-card card" role="dialog" aria-modal onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" onClick={()=>setOpen(false)}><X size={18}/></button><span className="eyebrow">A NEW INTENTION</span><h2 className="serif">What would feel good?</h2><p>Pick one small area to focus on. You can adjust it whenever life changes.</p><form className="form-stack" onSubmit={createGoal}><label><span className="label">Focus</span><select className="field" value={type} onChange={e=>{const v=e.target.value as GoalInput['goalType'];setType(v);setTarget(({water_ml:'2200',steps:'8000',exercise_min:'30',sleep_hrs:'8',weight_kg:'70',calories_kcal:'2000'} as Record<string,string>)[v])}}><option value="steps">Daily steps</option><option value="water_ml">Water</option><option value="exercise_min">Movement</option><option value="sleep_hrs">Sleep</option><option value="weight_kg">Weight</option><option value="calories_kcal">Nutrition</option></select></label><label><span className="label">Target ({units[type]})</span><input className="field" type="number" step={type==='sleep_hrs'||type==='weight_kg'?'0.1':'1'} min="1" value={target} onChange={e=>setTarget(e.target.value)} required/></label><button className="btn btn-primary" disabled={create.isPending}>{create.isPending?'Saving…':'Set this intention'} <ArrowRight size={16}/></button></form></div></div>}
    {toast&&<Notice text={toast} clear={()=>setToast('')}/>}
  </>;
}

function RemindersPage() {
  const query=useGetReminders({query:{queryKey:getGetRemindersQueryKey()}}); const create=useCreateReminder(); const update=useUpdateReminder(); const remove=useDeleteReminder(); const qc=useQueryClient();
  const [open,setOpen]=useState(false); const [toast,setToast]=useState('');
  const [permission,setPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission);
  const invalidate=()=>qc.invalidateQueries({queryKey:getGetRemindersQueryKey()});
  const askPermission=async()=>{if(typeof Notification==='undefined'){setToast('Notifications are not available in this browser');return;}const p=await Notification.requestPermission();setPermission(p);setToast(p==='granted'?'Browser notifications are on':'You can change this in browser settings');};
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data:ReminderInput={title:String(f.get('title')),category:String(f.get('category')) as ReminderInput['category'],timeOfDay:String(f.get('timeOfDay')),frequency:String(f.get('frequency')) as ReminderInput['frequency'],isEnabled:true};create.mutate({data},{onSuccess:()=>{invalidate();setOpen(false);setToast('Reminder added to your routine')},onError:e=>setToast(errorText(e))});};
  const toggle=(id:string,isEnabled:boolean)=>update.mutate({id,data:{isEnabled:!isEnabled}},{onSuccess:invalidate,onError:e=>setToast(errorText(e))});
  const del=(id:string)=>{if(!window.confirm('Delete this reminder?'))return;remove.mutate({id},{onSuccess:()=>{invalidate();setToast('Reminder removed')},onError:e=>setToast(errorText(e))});};
  return <><PageTitle eyebrow="A LITTLE NUDGE" title="Gentle reminders." sub="A friendly tap on the shoulder, when it helps." action={<button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={17}/>Add reminder</button>}/>
    <div className="permission-card card"><div className="permission-icon"><Bell size={20}/></div><div><b>Let your browser give you a nudge</b><p>{permission==='granted'?'Browser notifications are enabled. Your reminders are ready to help.':permission==='denied'?'Notifications are blocked. You can allow them in your browser settings.':'We’ll ask before showing any notifications.'}</p></div><button className="btn btn-soft" onClick={askPermission} disabled={permission==='granted'||permission==='denied'}>{permission==='granted'?'Enabled':permission==='denied'?'Blocked':'Enable notifications'}</button></div>
    {query.isLoading?<Loading/>:query.isError?<ErrorState message={errorText(query.error)} retry={()=>query.refetch()}/>:query.data?.length?<div className="reminder-list">{query.data.map(r=><article className={`reminder-row card ${!r.isEnabled?'disabled':''}`} key={r.id}><span className={`reminder-icon ${r.category}`}><ReminderIcon category={r.category}/></span><div className="reminder-info"><b>{r.title}</b><small><Clock3 size={13}/>{r.timeOfDay} <span>·</span> {r.frequency}</small></div><button className={`switch ${r.isEnabled?'on':''}`} role="switch" aria-checked={r.isEnabled} aria-label={`${r.isEnabled?'Turn off':'Turn on'} ${r.title}`} onClick={()=>toggle(r.id,r.isEnabled)}><span/></button><button className="icon-button" onClick={()=>del(r.id)} title="Delete reminder"><Trash2 size={16}/></button></article>)}</div>:<div className="empty-state card"><span className="empty-icon"><Bell/></span><h3>Nothing interrupting your day</h3><p>Set a gentle reminder for something you’d like to remember to do.</p><button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={16}/>Create a reminder</button></div>}
    {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal-card card" role="dialog" aria-modal onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" onClick={()=>setOpen(false)}><X size={18}/></button><span className="eyebrow">A GENTLE NUDGE</span><h2 className="serif">Make it easy to remember.</h2><form className="form-stack" onSubmit={submit}><label><span className="label">Reminder</span><input className="field" name="title" required minLength={2} placeholder="Take a short stretch break"/></label><div className="two-fields"><label><span className="label">For</span><select className="field" name="category"><option value="water">Water</option><option value="exercise">Movement</option><option value="sleep">Sleep</option><option value="medication">Medication</option><option value="break">A little break</option></select></label><label><span className="label">At</span><input className="field" name="timeOfDay" type="time" defaultValue="10:00" required/></label></div><label><span className="label">Repeat</span><select className="field" name="frequency"><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option></select></label><button className="btn btn-primary" disabled={create.isPending}>{create.isPending?'Adding…':'Add reminder'} <ArrowRight size={16}/></button></form></div></div>}
    {toast&&<Notice text={toast} clear={()=>setToast('')}/>}
  </>;
}
function ReminderIcon({category}:{category:string}) { const Comp=category==='water'?Droplets:category==='exercise'?Dumbbell:category==='sleep'?Moon:category==='medication'?Heart:Waves;return <Comp size={18}/>; }

function AssistantPage() {
  const insight=useGetDailyInsight({query:{queryKey:getGetDailyInsightQueryKey()}}); const digest=useGetWeeklyDigest({query:{queryKey:getGetWeeklyDigestQueryKey()}}); const chat=useSendAiChat();
  const [question,setQuestion]=useState(''); const [messages,setMessages]=useState<{role:'user'|'assistant';text:string}[]>([]);
  const submit=(e:FormEvent)=>{e.preventDefault();const q=question.trim();if(!q||chat.isPending)return;setMessages(m=>[...m,{role:'user',text:q}]);setQuestion('');chat.mutate({data:{message:q}},{onSuccess:r=>setMessages(m=>[...m,{role:'assistant',text:r.answer}]),onError:e=>setMessages(m=>[...m,{role:'assistant',text:`I couldn’t reach your wellness guide just now. ${errorText(e)}`}])});};
  return <><PageTitle eyebrow="A THOUGHTFUL COMPANION" title="Your wellness guide." sub="A little perspective, grounded in the days you’ve logged."/>
    <div className="assistant-layout"><div className="assistant-main card"><div className="assistant-head"><span className="assistant-avatar"><Sparkles size={20}/></span><div><b>Ada, your wellness guide</b><small>Here to help you reflect</small></div><span className="online-mark"/></div>
      <div className="chat-messages"><div className="chat-welcome"><span className="eyebrow">A GENTLE PLACE TO ASK</span><p>Hi. I can help you think through your habits, notice patterns in your logs, or find one small step for today. What’s on your mind?</p><Disclaimer compact/></div>
        {messages.map((m,i)=><div key={i} className={`chat-bubble ${m.role}`}><span>{m.text}</span>{m.role==='assistant'&&<Disclaimer compact/>}</div>)}{chat.isPending&&<div className="chat-bubble assistant"><span className="typing"><i/><i/><i/></span></div>}
      </div><form className="chat-compose" onSubmit={submit}><input className="field" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} placeholder="Ask about a habit, or how you’ve been feeling…" aria-label="Ask your wellness guide" data-testid="input-chat"/><button className="btn btn-primary send-btn" disabled={!question.trim()||chat.isPending} aria-label="Send message"><Send size={17}/></button></form><div className="chat-legal"><ShieldCheck size={13}/>{disclaimer}</div>
    </div><aside className="assistant-aside"><div className="card digest-card"><div className="section-head"><div><span className="eyebrow">A WEEK IN REVIEW</span><h3 className="serif">Your gentle digest</h3></div><Sparkles size={18}/></div>{digest.isLoading?<div className="skeleton-line wide"/>:digest.data?<><p>{digest.data.summary}</p>{digest.data.wins?.length>0&&<div className="digest-part"><b><CheckCircle2 size={15}/>Things going well</b>{digest.data.wins.map((w,i)=><span key={i}>{w}</span>)}</div>}{digest.data.focusAreas?.length>0&&<div className="digest-part"><b><Sprout size={15}/>A place to be curious</b>{digest.data.focusAreas.map((w,i)=><span key={i}>{w}</span>)}</div>}{digest.data.microAdjustments?.length>0&&<div className="digest-part"><b><ArrowRight size={15}/>Small adjustments</b>{digest.data.microAdjustments.map((w,i)=><span key={i}>{w}</span>)}</div>}</>:<p>Your weekly reflection will show up here after you have a few days of notes.</p>}<Disclaimer compact/></div>
      <div className="card assistant-insight"><span className="eyebrow">TODAY’S THOUGHT</span>{insight.data?<><h3 className="serif">{insight.data.headline}</h3><p>{insight.data.encouragement}</p>{insight.data.insights?.[0]&&<small>{insight.data.insights[0].microAction}</small>}</>:<p>A little context grows with each day you log.</p>}<Disclaimer compact/></div>
    </aside></div></>;
}

function ProfilePage({profile}:{profile:UserProfile}) {
  const query=useGetProfile(); const update=useUpdateProfile(); const qc=useQueryClient(); const [toast,setToast]=useState('');
  const p=query.data||profile;
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data:ProfileInput={name:String(f.get('name')),age:f.get('age')?Number(f.get('age')):null,gender:String(f.get('gender')),heightCm:f.get('heightCm')?Number(f.get('heightCm')):null,weightKg:f.get('weightKg')?Number(f.get('weightKg')):null,activityLevel:String(f.get('activityLevel')) as ProfileInput['activityLevel'],themePreference:p.themePreference||'light',waterGoalMl:Number(f.get('waterGoalMl')),stepsGoal:Number(f.get('stepsGoal')),exerciseGoalMinutes:Number(f.get('exerciseGoalMinutes')),sleepGoalHours:Number(f.get('sleepGoalHours'))};update.mutate({data},{onSuccess:res=>{qc.setQueryData(getGetProfileQueryKey(),res);qc.setQueryData(getGetMeQueryKey(),res);setToast('Your profile is up to date')},onError:e=>setToast(errorText(e))});};
  return <><PageTitle eyebrow="YOUR DETAILS" title="A space that fits you." sub="Your details help make your daily view feel a little more personal."/>
    {query.isLoading?<Loading/>:query.isError?<ErrorState message={errorText(query.error)} retry={()=>query.refetch()}/>:<form className="profile-form card" onSubmit={submit}><div className="profile-form-head"><span className="avatar profile-avatar">{p.name?.charAt(0)||'Y'}</span><div><h2>{p.name}</h2><p>{p.email}</p></div><span className="profile-private"><LockKeyhole size={14}/>Private to you</span></div><div className="profile-section"><div><span className="eyebrow">ABOUT YOU</span><h3 className="serif">The essentials</h3></div><div className="profile-fields"><label><span className="label">Name</span><input name="name" className="field" defaultValue={p.name}/></label><label><span className="label">Email</span><input className="field" value={p.email} readOnly/></label><div className="two-fields"><label><span className="label">Age</span><input name="age" className="field" type="number" defaultValue={p.age??''}/></label><label><span className="label">Gender</span><select name="gender" className="field" defaultValue={p.gender}><option value="prefer_not_to_say">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non_binary">Non-binary</option><option value="self_describe">Self describe</option></select></label></div><div className="two-fields"><label><span className="label">Height (cm)</span><input name="heightCm" className="field" type="number" defaultValue={p.heightCm??''}/></label><label><span className="label">Weight (kg)</span><input name="weightKg" className="field" type="number" step=".1" defaultValue={p.weightKg??''}/></label></div><label><span className="label">Usual activity</span><select name="activityLevel" className="field" defaultValue={p.activityLevel}><option value="sedentary">Mostly sitting</option><option value="light">A little movement</option><option value="moderate">A balanced mix</option><option value="active">Quite active</option><option value="very_active">Very active most days</option></select></label></div></div>
      <div className="profile-section"><div><span className="eyebrow">DAILY INTENTIONS</span><h3 className="serif">The goals you’ve chosen</h3></div><div className="profile-fields"><div className="two-fields"><label><span className="label">Water (ml)</span><input name="waterGoalMl" className="field" type="number" min="250" defaultValue={p.goals?.waterMl??2200}/></label><label><span className="label">Steps</span><input name="stepsGoal" className="field" type="number" min="500" defaultValue={p.goals?.steps??8000}/></label></div><div className="two-fields"><label><span className="label">Movement (min)</span><input name="exerciseGoalMinutes" className="field" type="number" min="0" defaultValue={p.goals?.exerciseMinutes??30}/></label><label><span className="label">Sleep (hours)</span><input name="sleepGoalHours" className="field" type="number" min="1" max="24" step=".5" defaultValue={p.goals?.sleepHours??8}/></label></div></div></div><div className="profile-submit"><Disclaimer compact/><button className="btn btn-primary" disabled={update.isPending}>{update.isPending?'Saving…':'Save your details'} <Check size={16}/></button></div></form>}
    {toast&&<Notice text={toast} clear={()=>setToast('')}/>}
  </>;
}

function SettingsPage({profile}:{profile:UserProfile}) {
  const update=useUpdateProfile(); const exp=useExportUserData({query:{enabled:false,queryKey:getExportUserDataQueryKey()}}); const del=useDeleteAccount(); const qc=useQueryClient(); const [,go]=useLocation();
  const [toast,setToast]=useState(''); const [theme,setTheme]=useState(profile.themePreference||'light');
  useEffect(()=>{document.documentElement.classList.toggle('dark',theme==='dark');},[theme]);
  useEffect(()=>{if(!exp.data)return;const blob=new Blob([JSON.stringify(exp.data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='wellnest-health-data.json';a.click();URL.revokeObjectURL(a.href);setToast('Your data export is ready');},[exp.data]);
  const setThemePreference=(value:'light'|'dark')=>{setTheme(value);const data:ProfileInput={name:profile.name,age:profile.age,gender:profile.gender,heightCm:profile.heightCm,weightKg:profile.weightKg,activityLevel:profile.activityLevel,themePreference:value,waterGoalMl:profile.goals?.waterMl??2200,stepsGoal:profile.goals?.steps??8000,exerciseGoalMinutes:profile.goals?.exerciseMinutes??30,sleepGoalHours:profile.goals?.sleepHours??8};update.mutate({data},{onSuccess:p=>{qc.setQueryData(getGetProfileQueryKey(),p);qc.setQueryData(getGetMeQueryKey(),p);setToast('Display preference saved')},onError:e=>setToast(errorText(e))});};
  const exportData=()=>{setToast('Preparing your personal data…');exp.refetch();};
  const deleteAccount=()=>{if(!window.confirm('Permanently delete your account and all personal health data? This cannot be undone.'))return;del.mutate(undefined,{onSuccess:()=>{qc.clear();go('/register')},onError:e=>setToast(errorText(e))});};
  return <><PageTitle eyebrow="YOUR SPACE, YOUR CHOICES" title="Settings." sub="A few ways to make Wellnest feel right for you."/>
    <div className="settings-stack"><section className="setting-row card"><div className="setting-icon"><Sun size={19}/></div><div className="setting-copy"><b>Appearance</b><p>Choose the light that feels best.</p></div><div className="theme-picker"><button className={theme==='light'?'chosen':''} onClick={()=>setThemePreference('light')}><Sun size={16}/>Light</button><button className={theme==='dark'?'chosen':''} onClick={()=>setThemePreference('dark')}><Moon size={16}/>Dark</button></div></section>
      <section className="setting-row card"><div className="setting-icon"><Download size={19}/></div><div className="setting-copy"><b>Your data, yours to keep</b><p>Download a copy of your profile, daily notes, intentions, and reminders.</p></div><button className="btn btn-soft" onClick={exportData} disabled={exp.isFetching}>{exp.isFetching?'Preparing…':'Export data'} <Download size={15}/></button></section>
      <section className="setting-row card danger-setting"><div className="setting-icon"><Trash2 size={19}/></div><div className="setting-copy"><b>Close your Wellnest space</b><p>Permanently remove your account and all saved health information.</p></div><button className="btn btn-danger" onClick={deleteAccount} disabled={del.isPending}>{del.isPending?'Removing…':'Delete account'}</button></section>
    </div>
    <div className="settings-note"><ShieldCheck size={17}/><span>Your health information is personal. We’ll never use it to define you.</span><Link href="/profile">Review your details <ArrowRight size={14}/></Link></div>
    {toast&&<Notice text={toast} clear={()=>setToast('')}/>}
  </>;
}

function NotFoundPage() {
  return <div className="empty-state card"><span className="empty-icon"><CircleHelp/></span><h2 className="serif">This path wandered off.</h2><p>Let’s find our way back to something familiar.</p><Link href="/dashboard" className="btn btn-primary">Back to today <ArrowRight size={16}/></Link><Disclaimer/></div>;
}

function ProtectedRoute({ children, path }: { children: (profile: UserProfile) => ReactNode; path: string }) {
  const [location, go] = useLocation();
  const me=useGetMe({query:{enabled:true,queryKey:getGetMeQueryKey(),staleTime:30000}});
  const profile=useGetProfile({query:{enabled:!!me.data,queryKey:getGetProfileQueryKey(),staleTime:30000}});
  useEffect(()=>{if(me.isError){go('/login');}else if(me.data&&!me.data.onboardingComplete&&location!=='/onboarding'){go('/onboarding');}else if(me.data?.onboardingComplete&&location==='/onboarding'){go('/dashboard');}},[me.isError,me.data?.onboardingComplete,location,go]);
  if(me.isLoading || (me.data&&!me.data.onboardingComplete&&location!=='/onboarding')) return <main className="protected-loader"><div><Loading label="Opening your personal space…" /><Disclaimer /></div></main>;
  if(me.isError || !me.data) return <main className="protected-loader"><div><Loading label="Returning you to sign in…" /><Disclaimer /></div></main>;
  if(location==='/onboarding') return <Onboarding profile={me.data}/>;
  if(profile.isLoading&&!profile.data) return <main className="protected-loader"><Loading/></main>;
  const data=profile.data||me.data;
  let content:ReactNode;
  switch(path){
    case '/dashboard': content=<Dashboard profile={data}/>;break;
    case '/records': content=<RecordsPage/>;break;
    case '/analytics': content=<AnalyticsPage/>;break;
    case '/goals': content=<GoalsPage/>;break;
    case '/reminders': content=<RemindersPage/>;break;
    case '/ai-assistant': content=<AssistantPage/>;break;
    case '/profile': content=<ProfilePage profile={data}/>;break;
    case '/settings': content=<SettingsPage profile={data}/>;break;
    default: content=<NotFoundPage/>;
  }
  return <Shell profile={data}>{content}</Shell>;
}

function AppRoutes() {
  return <Switch>
    <Route path="/" component={Landing}/>
    <Route path="/login" component={()=><AuthPage mode="login"/>}/>
    <Route path="/register" component={()=><AuthPage mode="register"/>}/>
    <Route path="/onboarding">{()=> <ProtectedRoute path="/onboarding">{p=><Onboarding profile={p}/>}</ProtectedRoute>}</Route>
    <Route path="/dashboard">{()=> <ProtectedRoute path="/dashboard">{p=><Dashboard profile={p}/>}</ProtectedRoute>}</Route>
    <Route path="/records">{()=> <ProtectedRoute path="/records">{()=> <RecordsPage/>}</ProtectedRoute>}</Route>
    <Route path="/analytics">{()=> <ProtectedRoute path="/analytics">{()=> <AnalyticsPage/>}</ProtectedRoute>}</Route>
    <Route path="/goals">{()=> <ProtectedRoute path="/goals">{()=> <GoalsPage/>}</ProtectedRoute>}</Route>
    <Route path="/reminders">{()=> <ProtectedRoute path="/reminders">{()=> <RemindersPage/>}</ProtectedRoute>}</Route>
    <Route path="/ai-assistant">{()=> <ProtectedRoute path="/ai-assistant">{()=> <AssistantPage/>}</ProtectedRoute>}</Route>
    <Route path="/profile">{()=> <ProtectedRoute path="/profile">{p=><ProfilePage profile={p}/>}</ProtectedRoute>}</Route>
    <Route path="/settings">{()=> <ProtectedRoute path="/settings">{p=><SettingsPage profile={p}/>}</ProtectedRoute>}</Route>
    <Route><NotFoundPage/></Route>
  </Switch>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AppRoutes/></QueryClientProvider>;
}
