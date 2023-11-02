import {
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Icon,
  Layout,
  Menu,
  Message,
  Spin,
} from "@arco-design/web-react";
import enUS from "@arco-design/web-react/es/locale/en-US";
import { IconMoonFill, IconSunFill, IconThunderbolt } from "@arco-design/web-react/icon";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Theme } from "../libs/config";
import { TaskStateCode } from "../libs/task/state_machine";
import { pageRoutes } from "../router";
import { useAppStore } from "../store/app";
import { useTaskStore } from "../store/task";
import { loadConfiguration } from "../tauri/system";
import "../libs/system_tray";
import "../libs/safe_exit";
import "../libs/task/message";

/**
 * Sidebar menu
 */
const SidebarMenu = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = pageRoutes.map(({ path, id, title, icon }) => {
    return (
      <Menu.Item renderItemInTooltip={() => title} key={id} onClick={() => navigate(path ?? "/")}>
        {icon}
        {title}
      </Menu.Item>
    );
  });

  const selectedKey = useMemo(() => {
    const id = pageRoutes.find(({ path }) => location.pathname.startsWith(`/${path}`))?.id;
    return id ? [id] : [];
  }, [location]);

  return <Menu selectedKeys={selectedKey}>{menuItems}</Menu>;
};

/**
 * Theme switcher
 */
const ThemeSwitcher = () => {
  const { currentTheme, configuration, updateConfiguration } = useAppStore();

  const icon = useMemo(() => {
    switch (configuration.theme) {
      case Theme.Light:
        return <IconSunFill />;
      case Theme.Dark:
        return <IconMoonFill />;
      case Theme.FollowSystem:
        return <IconThunderbolt />;
    }
  }, [configuration.theme]);

  const droplist = useMemo(
    () => (
      <Menu onClickMenuItem={(theme) => updateConfiguration({ theme: theme as Theme })}>
        <Menu.Item key={Theme.Light}>
          {configuration.theme === Theme.Light ? <IconSunFill /> : <Icon />} Light
        </Menu.Item>
        <Menu.Item key={Theme.Dark}>
          {configuration.theme === Theme.Dark ? <IconMoonFill /> : <Icon />} Dark
        </Menu.Item>
        <Menu.Item key={Theme.FollowSystem}>
          {configuration.theme === Theme.FollowSystem ? <IconThunderbolt /> : <Icon />} Follow
          System
        </Menu.Item>
      </Menu>
    ),
    [configuration.theme, updateConfiguration]
  );

  return (
    <Dropdown droplist={droplist}>
      <Button
        shape="circle"
        icon={icon}
        onClick={() => {
          if (currentTheme === Theme.Dark) {
            updateConfiguration({ theme: Theme.Light });
          } else {
            updateConfiguration({ theme: Theme.Dark });
          }
        }}
      ></Button>
    </Dropdown>
  );
};

/**
 * Tasks statistic
 */
const TaskStatistic = () => {
  const { tasks } = useTaskStore();
  const count = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.state.code !== TaskStateCode.Errored &&
          task.state.code !== TaskStateCode.Finished &&
          task.state.code !== TaskStateCode.Stopped
      ).length,
    [tasks]
  );
  return <Badge count={count}></Badge>;
};

/**
 * Sidebar utilities in icon button style
 */
const SidebarUtilities = () => {
  return (
    <div className="p-2 gap-2 flex flex-col items-start justify-center">
      {/* Tasks Statistic */}
      <TaskStatistic />

      {/* Theme Switcher */}
      <ThemeSwitcher />
    </div>
  );
};

/**
 * Main Page
 */
const MainPage = () => {
  const [collapsed, setCollapse] = useState(true);

  /**
   * Listens all unhandled rejection and pop error message
   */
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      Message.error(e.reason instanceof Error ? e.reason.message : e.reason);
    };
    window.addEventListener("unhandledrejection", handler);

    return () => {
      window.removeEventListener("unhandledrejection", handler);
    };
  });

  return (
    <Layout className="h-full">
      {/* Sidebar */}
      <Layout.Sider collapsible collapsed={collapsed} onCollapse={setCollapse}>
        <div className="h-full flex flex-col justify-between">
          {/* Menu */}
          <SidebarMenu />

          {/* Utilities Buttons */}
          <SidebarUtilities />
        </div>
      </Layout.Sider>

      {/* Main Content */}
      <Layout>
        <Layout.Content>
          <Outlet></Outlet>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

/**
 * Loading Page
 */
const LoadingPage = () => {
  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <Spin size={40} tip="Starting Up..."></Spin>
    </div>
  );
};

/**
 * App entry
 */
export default function App() {
  const navigate = useNavigate();
  const { configuration, setSystemParticulars } = useAppStore();

  const [isLoading, setLoading] = useState(true);
  // gets system particulars, and redirects to settings page if error occurs
  // execute only once
  useEffect(() => {
    loadConfiguration(configuration)
      .then((systemParticulars) => {
        setSystemParticulars(systemParticulars);
      })
      .catch((err) => {
        console.error(err);
        navigate("/settings");
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConfigProvider
      locale={enUS}
      componentConfig={{
        Menu: {
          tooltipProps: { triggerProps: { mouseEnterDelay: 500 } },
        },
        Tooltip: { mini: true, triggerProps: { mouseEnterDelay: 500 } },
      }}
    >
      {isLoading ? <LoadingPage /> : <MainPage />}
    </ConfigProvider>
  );
}
