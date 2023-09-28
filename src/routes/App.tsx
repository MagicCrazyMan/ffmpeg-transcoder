import { Button, ConfigProvider, Dropdown, Icon, Layout, Menu, Spin } from "@arco-design/web-react";
import { IconCheck, IconMoonFill, IconSunFill, IconThunderbolt } from "@arco-design/web-react/icon";
import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { pageRoutes } from "../router";
import { Theme, useAppStore } from "../store/app";

const MenuItem = Menu.Item;
const Sider = Layout.Sider;
const Content = Layout.Content;

/**
 * Sidebar menu
 */
const SidebarMenu = () => {
  const navigate = useNavigate();

  const menuItems = pageRoutes.map(({ path, id, title, icon }) => {
    return (
      <MenuItem key={id} onClick={() => navigate(path!)}>
        {icon}
        {title}
      </MenuItem>
    );
  });

  return <Menu>{menuItems}</Menu>;
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
    <MenuItem key={t}>
      {theme === t ? <IconCheck /> : <Icon />} {s}
    </MenuItem>
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
    <ConfigProvider>
      <Layout className="h-full">
        {/* Sidebar */}
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapse}>
          <div className="h-full flex flex-col justify-between">
            {/* Menu */}
            <SidebarMenu />

            {/* Utilities Buttons */}
            <SidebarUtilities />
          </div>
        </Sider>

        {/* Main Content */}
        <Layout>
          <Content className="p-4">
            <Outlet></Outlet>
          </Content>
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
    <ConfigProvider>
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
