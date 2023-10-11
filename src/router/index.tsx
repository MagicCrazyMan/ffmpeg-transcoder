import {
  IconInfoCircleFill,
  IconSearch,
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
    id: "queue",
    path: "queue",
    title: "Queue",
    icon: <IconUnorderedList />,
    async lazy() {
      const { default: Component } = await import("../routes/Queue");
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
    id: "particulars",
    path: "particulars",
    title: "Particulars",
    icon: <IconInfoCircleFill />,
    async lazy() {
      const { default: Component } = await import("../routes/Particulars");
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
