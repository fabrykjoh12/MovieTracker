import { HashRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { StoreProvider } from "./store";
import { Home } from "./pages/Home";
import { Discover } from "./pages/Discover";
import { Library } from "./pages/Library";
import { Friends } from "./pages/Friends";
import { Profile } from "./pages/Profile";
import { MediaDetail } from "./pages/MediaDetail";

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="discover" element={<Discover />} />
            <Route path="library" element={<Library />} />
            <Route path="friends" element={<Friends />} />
            <Route path="profile" element={<Profile />} />
            <Route path="title/:id" element={<MediaDetail />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
