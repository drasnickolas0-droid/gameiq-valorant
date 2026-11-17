import { SignIn, SignUp } from "@clerk/react";
import { Link } from "react-router-dom";

export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#090A0F] text-white flex items-center justify-center p-4 bg-grid">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[160px]"/>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[140px]"/>
      </div>
      <div className="relative w-full max-w-md flex flex-col items-center">
        <Link to="/" data-testid="auth-brand" className="flex items-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 grid place-items-center font-black text-xl glow-purple">G</div>
          <div>
            <div className="font-black tracking-tight text-2xl leading-none">GAME<span className="gradient-text">IQ</span></div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Personal Gaming Coach</div>
          </div>
        </Link>
        {children}
      </div>
    </div>
  );
}

export function SignInPage() {
  return <AuthLayout><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthLayout>;
}
export function SignUpPage() {
  return <AuthLayout><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthLayout>;
}
