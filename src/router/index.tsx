import {
  IconHistory,
  IconInfoCircleFill,
  IconSearch,
  IconSettings,
  IconTags,
  IconUnorderedList,
} from "@arco-design/web-react/icon";
import { RouteObject, createBrowserRouter } from "react-router-dom";

export type PageRouteObject = {
  id: string;
  title: string;
  icon: React.ReactNode;
} & RouteObject;

export const pageRoutes: PageRouteObject[] = [
  {
    id: "tasks",
    path: "tasks",
    title: "Tasks",
    icon: <IconUnorderedList />,
    async lazy() {
      const { default: Component } = await import("../routes/Tasks");
      return { Component };
    },
  },
  {
    id: "search",
    path: "search",
    title: "Search",
    icon: <IconSearch />,
    async lazy() {
      const { default: Component } = await import("../routes/Search");
      return { Component };
    },
  },
  {
    id: "presets",
    path: "presets",
    title: "Codec Presets",
    icon: <IconTags />,
    async lazy() {
      const { default: Component } = await import("../routes/Presets");
      return { Component };
    },
  },
  {
    id: "history",
    path: "history",
    title: "History",
    icon: <IconHistory />,
    async lazy() {
      const { default: Component } = await import("../routes/History");
      return { Component };
    },
  },
  {
    id: "particulars",
    path: "particulars",
    title: "Particulars",
    icon: <IconInfoCircleFill />,
    async lazy() {
      const { default: Component } = await import("../routes/Particulars");
      return { Component };
    },
  },
  {
    id: "settings",
    path: "settings",
    title: "Settings",
    icon: <IconSettings />,
    async lazy() {
      const { default: Component } = await import("../routes/Settings");
      return { Component };
    },
  },
];

export const router = createBrowserRouter([
  {
    path: "/",
    children: pageRoutes,
    async lazy() {
      const { default: Component } = await import("../routes/App");
      return { Component };
    },
  },
]);
