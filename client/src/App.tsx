import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { NoAccess } from "./components/NoAccess";
import { bootstrapToken } from "./lib/auth";
import "./App.css";

export function App() {
  const [token] = useState(bootstrapToken);

  if (!token) {
    return <NoAccess />;
  }

  return <Dashboard />;
}
