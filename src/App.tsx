import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ChatLauncher from "./components/chat/ChatLauncher";
import ChatPane from "./components/chat/ChatPane";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Systems from "./pages/Systems";
import About from "./pages/About";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: "instant" }), [pathname]);
  return null;
}

function App() {
  const { pathname } = useLocation();
  const isAdminArea = pathname.startsWith("/admin") || pathname === "/dashboard";

  return (
    <div className="site-shell">
      <ScrollManager />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {!isAdminArea ? <Navbar /> : null}
      <main><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></main>
      {!isAdminArea ? <Footer /> : null}
      {!isAdminArea ? <ChatLauncher /> : null}
      {!isAdminArea ? <ChatPane /> : null}
    </div>
  );
}

export default App;
