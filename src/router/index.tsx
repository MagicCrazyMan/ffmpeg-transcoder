import { createBrowserRouter } from "react-router-dom";
import App from "../routes/App";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
]);
