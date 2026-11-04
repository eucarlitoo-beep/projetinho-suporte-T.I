import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Workspace from "@/pages/Workspace";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ClerkAuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in/*" element={<AuthPage mode="sign-in" />} />
          <Route path="/sign-up/*" element={<AuthPage mode="sign-up" />} />
          <Route path="/app" element={<Workspace />} />
          <Route path="/app/:channelId" element={<Workspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ClerkAuthProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
