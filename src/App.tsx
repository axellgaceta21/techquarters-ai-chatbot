import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ChatLauncher from "./components/chat/ChatLauncher";
import ChatPane from "./components/chat/ChatPane";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Systems from "./pages/Systems";
import About from "./pages/About";
import Contact from "./pages/Contact";

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: "instant" }), [pathname]);
  return null;
}

function App() {
  return (
    <div className="site-shell">
      <ScrollManager />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Navbar />
      <main><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
      </Routes></main>
      <Footer />
      <ChatLauncher />
      <ChatPane />
    </div>
  );
}

export default App;
