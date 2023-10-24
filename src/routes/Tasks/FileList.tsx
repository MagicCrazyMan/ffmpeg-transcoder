import { Button, Space } from "@arco-design/web-react";
import { IconFolder, IconPlayArrow } from "@arco-design/web-react/icon";
import { OsType } from "@tauri-apps/api/os";
import { Command, open } from "@tauri-apps/api/shell";
import { useMemo } from "react";
import { Task } from "../../libs/task";
import { TaskStateCode } from "../../libs/task/state_machine";
import { useAppStore } from "../../store/app";

const showInExplorer = async (path: string, osType: OsType) => {
  if (osType === "Windows_NT") {
    const command = new Command("explorer", ["/select,", path]);
    await command.spawn();
  }
};

const ShowInExplorerButton = ({ path }: { path: string }) => {
  const osType = useAppStore((state) => state.osType);

  return osType === "Windows_NT" ? (
    <Button
      size="mini"
      type="text"
      shape="circle"
      icon={<IconFolder />}
      onClick={(e) => {
        e.stopPropagation();
        showInExplorer(path, osType);
      }}
    ></Button>
  ) : null;
};

const OpenFileButton = ({ path }: { path: string }) => {
  return (
    <Button
      size="mini"
      type="text"
      shape="circle"
      icon={<IconPlayArrow />}
      onClick={(e) => {
        e.stopPropagation();
        open(path);
      }}
    ></Button>
  );
};

const FileItem = ({
  path,
  task,
  type,
}: {
  path?: string;
  task: Task;
  type: "input" | "output";
}) => {
  return (
    <Space size="mini">
      {/* Show In Explorer Button */}
      {path && (type === "input" || task.state.code === TaskStateCode.Finished) ? (
        <ShowInExplorerButton path={path} />
      ) : null}

      {/* Open File Button */}
      {path && (type === "input" || task.state.code === TaskStateCode.Finished) ? (
        <OpenFileButton path={path} />
      ) : null}

      {/* File Name */}
      <div className="flex-1">{path ?? "NULL"}</div>
    </Space>
  );
};

/**
 * Inputs & Outputs files list component
 */
export default function FilesList({ task, type }: { task: Task; type: "input" | "output" }) {
  const args = useMemo(
    () => (type === "input" ? task.data.args.inputs : task.data.args.outputs),
    [task, type]
  );

  if (args.length === 1) {
    return <FileItem path={args[0].path} task={task} type={type} />;
  } else {
    const paths = args.map((arg, index) => (
      <li key={index}>
        <FileItem path={arg.path} task={task} type={type} />
      </li>
    ));
    return <ul className="list-disc list-inside">{paths}</ul>;
  }
}
