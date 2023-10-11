import { Button, ConfigProvider, Dropdown, Icon, Layout, Menu, Spin } from "@arco-design/web-react";
import enUS from "@arco-design/web-react/es/locale/en-US";
import { IconMoonFill, IconSunFill, IconThunderbolt } from "@arco-design/web-react/icon";
import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { pageRoutes } from "../router";
import { Theme, useAppStore } from "../store/app";

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

  return (
    <Menu
      tooltipProps={{ triggerProps: { mouseEnterDelay: 1000 } }}
      defaultSelectedKeys={[pageRoutes[0].id]}
      selectedKeys={selectedKey}
    >
      {menuItems}
    </Menu>
  );
};

/**
 * Theme switcher
 */
const ThemeSwitcher = () => {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const icon = useMemo(() => {
    switch (theme) {
      case Theme.Light:
        return <IconSunFill />;
      case Theme.Dark:
        return <IconMoonFill />;
      case Theme.Default:
        return <IconThunderbolt />;
    }
  }, [theme]);

  const droplistItems = [
    [Theme.Light, "Light Theme"],
    [Theme.Dark, "Dark Theme"],
    [Theme.Default, "Follow System"],
  ].map(([t, s]) => (
    <Menu.Item key={t}>
      {theme === t ? icon : <Icon />} {s}
    </Menu.Item>
  ));
  const droplist = (
    <Menu onClickMenuItem={(theme) => setTheme(theme as Theme)}>{droplistItems}</Menu>
  );

  return (
    <Dropdown droplist={droplist}>
      <Button
        shape="circle"
        icon={icon}
        onClick={() => {
          if (theme === Theme.Dark) {
            setTheme(Theme.Light);
          } else {
            setTheme(Theme.Dark);
          }
        }}
      ></Button>
    </Dropdown>
  );
};

/**
 * Sidebar utilities in icon button style
 */
const SidebarUtilities = () => {
  return (
    <div className="p-2">
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

  return (
    <ConfigProvider locale={enUS}>
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
          <Layout.Content className="p-4">
            <Outlet></Outlet>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

/**
 * Loading Page
 */
const LoadingPage = () => {
  return (
    <ConfigProvider locale={enUS}>
      <div className="h-screen w-screen flex justify-center items-center">
        <Spin size={40} tip="Starting Up..."></Spin>
      </div>
    </ConfigProvider>
  );
};

/**
 * App entry
 */
export default function App() {
  const systemParticulars = useAppStore((state) => state.systemParticulars);
  const updateSystemParticulars = useAppStore((state) => state.updateSystemParticulars);

  if (systemParticulars) {
    return <MainPage />;
  } else {
    updateSystemParticulars();
    return <LoadingPage />;
  }
}
