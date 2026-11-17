import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import { SignInPage, SignUpPage } from "@/pages/Auth";
import Welcome from "@/pages/Welcome";
import Dashboard from "@/pages/Dashboard";
import AICoach from "@/pages/AICoach";
import Weakness from "@/pages/Weakness";
import Challenges from "@/pages/Challenges";
import Progress from "@/pages/Progress";
import Performance from "@/pages/Performance";
import Profile from "@/pages/Profile";
import RiotAccount from "@/pages/RiotAccount";
import Plans from "@/pages/Plans";
import Subscription from "@/pages/Subscription";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ai-coach" element={<AICoach />} />
              <Route path="/weakness" element={<Weakness />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/riot" element={<RiotAccount />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </ClerkAuthProvider>
        <Toaster theme="dark" position="top-right" richColors />
      </BrowserRouter>
    </div>
  );
}
