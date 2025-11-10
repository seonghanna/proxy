import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import HomeMain from "./home/home_main/HomeMain";
import SellMain from "./sell/sell_main/SellMain";
import MyPageMain from "./mypage/mypage_main/MyPageMain";
import MessageMain from "./message/message_main/MessageMain";
import TopNav from "./common/TopNav";
import BottomNav from "./common/BottomNav";
import { pageVariants, pageTransition } from "./animations/pageTransition";
import AdminLayout from "./admin/AdminLayout";
import EventProducts from "./home/home_products/EventProducts"; 
import AuthCallback from "./auth/AuthCallback";


function AnimatedRoutes() {
  const location = useLocation();

  const withAnimation = (Component) => (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      <Component />
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={withAnimation(HomeMain)} />
        <Route path="/sell" element={withAnimation(SellMain)} />
        <Route path="/mypage" element={withAnimation(MyPageMain)} />
        <Route path="/message" element={withAnimation(MessageMain)} />
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/e/:eventId" element={<EventProducts />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <TopNav />
      <AnimatedRoutes />
      <BottomNav />
    </Router>
  );
}
