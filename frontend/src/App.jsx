import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ProtectedRoute } from './auth/index.js';
import Home from './pages/Home.jsx';
import Me from './pages/Me.jsx';
import NotFound from './pages/NotFound.jsx';
import LeasePage from './pages/lease/LeasePage.jsx';
import EventsPage from './pages/events/EventsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="lease" element={<LeasePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route
          path="me"
          element={
            <ProtectedRoute>
              <Me />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
