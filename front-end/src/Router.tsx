import {
    createBrowserRouter,
    Navigate,
  } from "react-router";
  import { Route } from "./constants/routes";
import AuthLayout from "./module/auth/AuthLatout";
import Login from "./module/auth/login";
import SignUp from "./module/auth/signin";
import PageNotFound from "./components/PageNotFound";
import StudentLayout from "./module/student";


const route=createBrowserRouter([
    {
        path:"*",
       element: <Navigate to={'/auth'}  replace/>
  
      },
      {
        path: "/auth",
        Component: AuthLayout,
        children: [
        { index: true, Component: SignUp },
          { path: Route.SIGN_UP, Component: SignUp },
          { path: Route.LOG_IN, Component: Login },

        ],
      },
      {
        path:"/student",
        Component:StudentLayout,
      },
      {
        path:"*",
        Component: PageNotFound,
      }

  
  ]);

export default route;
  