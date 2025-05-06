import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./routes/routes.jsx";

function App() {
  return(
    <Router basename="/MarianTBI_Monitoring">
      <AppRoutes />
    </Router>
  );
}

export default App
