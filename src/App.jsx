import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./routes/routes.jsx";

function App() {
  return(
    <Router basename="/MarianTBI_Montoring">
      <AppRoutes />
    </Router>
  );
}

export default App
