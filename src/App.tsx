import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { AdminRoute } from "@/components/AdminRoute";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Upload from "./pages/Upload";
import About from "./pages/About";
import ContentDetail from "./pages/ContentDetail";
import ProjectDetail from "./pages/ProjectDetail";
import CreatorProfile from "./pages/CreatorProfile";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Saved from "./pages/Saved";
import Feed from "./pages/Feed";
import MyUploads from "./pages/MyUploads";
import RecentPage from "./pages/Recent";
import FYPPage from "./pages/FYP";
import NotFound from "./pages/NotFound";
import NotificationsPage from "./pages/Notifications";
import MessagesPage from "./pages/Messages";
import CollectionDetail from "./pages/CollectionDetail";
// LearningPathDetail removed from UI
import Analytics from "./pages/Analytics";
import SearchPage from "./pages/SearchPage";
import Category from "./pages/Category";
import LibraryPage from "./pages/Library";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ConnectionBanner />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/recent" element={<RecentPage />} />
                <Route path="/fyp" element={<FYPPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/category/:slug" element={<Category />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/about" element={<About />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route path="/project/:id" element={<ProjectDetail />} />
                <Route path="/creator/:username" element={<CreatorProfile />} />
                <Route path="/collections/:slug" element={<CollectionDetail />} />
                <Route path="/path/:id" element={<LearningPathDetail />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
                <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/my-uploads" element={<ProtectedRoute requireCreator><MyUploads /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute requireCreator><Analytics /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
