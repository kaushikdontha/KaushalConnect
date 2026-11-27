import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Route, Routes } from 'react-router-dom';
import type { User } from './lib/api';
import { AuthPage, JobsPage, JobPage, Dashboard } from './screens';

function App() {
  const client = useQueryClient();
  const [session, setSession] = useState<{ token: string; user: User } | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kc-session') || 'null');
      return saved && typeof saved.token === 'string' && saved.user && typeof saved.user.name === 'string' && ['CANDIDATE', 'RECRUITER'].includes(saved.user.role) ? saved as { token: string; user: User } : null;
    } catch { return null; }
  });
  const saveSession = (value: { token: string; user: User }) => { client.clear(); localStorage.setItem('kc-session', JSON.stringify(value)); setSession(value); };
  const logout = () => { client.clear(); localStorage.removeItem('kc-session'); setSession(null); };
  useEffect(() => {
    const expire = () => { client.clear(); localStorage.removeItem('kc-session'); setSession(null); };
    window.addEventListener('kc-session-expired', expire);
    return () => window.removeEventListener('kc-session-expired', expire);
  }, [client]);
  return <>
    <header className="topbar"><Link className="brand" to="/">Kaushal<span>Connect</span></Link><nav><Link to="/jobs">Find work</Link>{session && <Link to="/dashboard">Dashboard</Link>}{session ? <><span className="nav-name">{session.user.name}</span><button className="link-button" onClick={logout}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link className="button small" to="/register">Create account</Link></>}</nav></header>
    <Routes><Route path="/" element={<Home />} /><Route path="/login" element={<AuthPage key="login" mode="login" onSession={saveSession} />} /><Route path="/register" element={<AuthPage key="register" mode="register" onSession={saveSession} />} /><Route path="/jobs" element={<JobsPage />} /><Route path="/jobs/:id" element={<JobPage session={session} />} /><Route path="/dashboard" element={<Dashboard session={session} />} /><Route path="*" element={<Home />} /></Routes>
    <footer>KaushalConnect <span>Opportunity grows when skills meet the right role.</span></footer>
  </>;
}

function Home() { return <main className="hero"><div className="hero-copy"><p className="eyebrow">EMPLOYMENT & SKILLING</p><h1>Find work that<br /><em>moves you forward.</em></h1><p className="intro">Discover opportunities that match your skills. Build a path from what you know to what comes next.</p><div className="actions"><Link className="button" to="/jobs">Explore opportunities <span>↗</span></Link><Link className="button secondary" to="/register">Join KaushalConnect</Link></div><div className="hero-note"><span className="status-dot" /> A better connection between skills and work</div></div><div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="skill-card"><div className="skill-icon">✳</div><span className="mini-label">YOUR NEXT CHAPTER</span><strong>Skills in motion</strong><div className="skill-tags"><span>React</span><span>Design</span><span>Growth</span></div><div className="match-line"><span>Opportunity match</span><b>92%</b></div><div className="progress"><i /></div></div><div className="floating-note">✦ &nbsp;Find your fit</div></div></main>; }


export default App;
