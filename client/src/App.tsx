import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { NoAccess } from './components/NoAccess';
import { bootstrapToken } from './lib/auth';
import './App.css';

export function App() {
  // Runs once: reads ?token= from a fresh bookmark link if present,
  // otherwise falls back to whatever's already saved. If neither exists,
  // there's no point even trying to fetch - show the no-access screen
  // immediately instead of a wasted 401 round trip.
  const [token] = useState(bootstrapToken);

  if (!token) {
    return <NoAccess />;
  }

  return <Dashboard />;
}
