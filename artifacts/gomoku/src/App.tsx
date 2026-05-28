import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import LobbyPage from "@/pages/LobbyPage";
import GamePage from "@/pages/GamePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LobbyPage} />
      <Route path="/game/:roomId" component={GamePage} />
      <Route>
        <LobbyPage />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </>
  );
}
