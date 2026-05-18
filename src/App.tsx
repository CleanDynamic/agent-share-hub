import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { BlobBackground } from "@/components/BlobBackground";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ShareMenuProvider } from "@/components/share/ShareMenuProvider";
import { ReblogComposeProvider } from "@/contexts/ReblogComposeContext";
import { QuotableSelectionProvider } from "@/components/quoting/QuotableSelectionProvider";
import { UploadPickerProvider } from "@/contexts/UploadPickerContext";
import { Layout } from "@/components/Layout";
import { AdminRoute } from "@/components/AdminRoute";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import Home from "./pages/Home";

import Discover from "./pages/Discover";
import DiscoverLegacy from "./pages/Discover.legacy";
import Upload from "./pages/Upload";
import UploadTypeSelector from "./pages/UploadTypeSelector";
import BlogUpload from "./pages/BlogUpload";
import BountyUploadShell from "./pages/BountyUploadShell";
import About from "./pages/About";
import ContentDetail from "./pages/ContentDetail";
import ContentOrReblogRoute from "@/components/routing/ContentOrReblogRoute";
import BountyLeaderboard from "./pages/BountyLeaderboard";
import ProjectDetail from "./pages/ProjectDetail";
import CreatorProfile from "./pages/CreatorProfile";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import LibraryPage from "./pages/Library";
import CollectionDetailRoute from "./pages/CollectionDetail";
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
import Search from "@/pages/Search";
import Category from "./pages/Category";
import ApiDocs from "./pages/ApiDocs";

import DraftsPage from "./pages/Drafts";
import PostPreviewPage from "./pages/PostPreview";
import PublishMetadata from "./pages/PublishMetadata";
import ContentEditPage from "./pages/ContentEdit";
import BountyUpload from "@/pages/BountyUpload";
const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <BlobBackground />
    <div style={{ position: "relative", zIndex: 1 }}>
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PresenceProvider />
            <ConnectionBanner />
            <ShareMenuProvider>
            <ReblogComposeProvider>
            <UploadPickerProvider>
            <QuotableSelectionProvider />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Discover />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/discover-legacy" element={<DiscoverLegacy />} />
                <Route path="/recent" element={<RecentPage />} />
                <Route path="/fyp" element={<FYPPage />} />
                <Route path="/search" element={<Search />} />
                <Route path="/category/:slug" element={<Category />} />
                <Route path="/upload" element={<UploadTypeSelector />} />
                <Route path="/upload/blueprint" element={<Upload />} />
                <Route path="/upload/blog" element={<BlogUpload />} />
                <Route path="/upload/bounty" element={<BountyUploadShell />} />
                <Route path="/about" element={<About />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route path="/b/:id" element={<ContentOrReblogRoute />} />
                <Route path="/b/:id/thread" element={<ContentOrReblogRoute mode="thread" />} />
                <Route path="/b/:id/leaderboard" element={<BountyLeaderboard />} />
                <Route path="/content/:id/edit" element={<ProtectedRoute requireCreator><ContentEditPage /></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProjectDetail />} />
                <Route path="/creator/:username" element={<CreatorProfile />} />
                <Route path="/collections/:slug" element={<CollectionDetail />} />
                {/* /path/:id route removed */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/:handle" element={<Profile />} />
                <Route path="/saved" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                <Route path="/library/collections/:collectionId" element={<CollectionDetailRoute />} />
                <Route path="/library/:handle/collections/:collectionId" element={<CollectionDetailRoute />} />
                <Route path="/library/:handle" element={<LibraryPage />} />
                
                <Route path="/drafts" element={<ProtectedRoute><DraftsPage /></ProtectedRoute>} />
                <Route path="/upload/preview/:draftId" element={<ProtectedRoute><PostPreviewPage /></ProtectedRoute>} />
                <Route path="/publish/:contentItemId" element={<ProtectedRoute><PublishMetadata /></ProtectedRoute>} />
                <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/messages/:threadId" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/my-uploads" element={<ProtectedRoute requireCreator><MyUploads /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute requireCreator><Analytics /></ProtectedRoute>} />
                <Route path="/bounty/new" element={<ProtectedRoute><BountyUpload /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </UploadPickerProvider>
            </ReblogComposeProvider>
            </ShareMenuProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </HelmetProvider>
    </div>
  </ErrorBoundary>
);

export default App;
