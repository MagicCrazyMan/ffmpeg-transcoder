import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import {
  IconDown,
  IconFolder,
  IconNav,
  IconPlayArrow,
  IconRight,
} from "@arco-design/web-react/icon";
import { type } from "@tauri-apps/api/os";
import { Command, open } from "@tauri-apps/api/shell";
import { useState } from "react";
import { Task, TaskInputParams, TaskOutputParams, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import Operations from "./Operations";
import Progress from "./Progress";
import Status from "./Status";

/**
 * Inputs & Outputs files list component
 */
const FilesList = ({ params }: { params: (TaskInputParams | TaskOutputParams)[] }) => {
  const showInExplorer = async (path?: string) => {
    if (!path) return;
    if ((await type()) !== "Windows_NT") return;

    const split = path.split("\\");
    split.pop();
    const dir = split.join("\\");
    const command = new Command("explorer", [dir]);
    await command.spawn();
  };

  const openFile = async (path?: string) => {
    if (!path) return;

    await open(path);
  };

  if (params.length === 1) {
    if (params[0].path) {
      return (
        <Space size="mini">
          {/* Show In Explorer Button */}
          <Button
            size="mini"
            type="text"
            shape="circle"
            icon={<IconFolder />}
            onClick={(e) => {
              e.stopPropagation();
              showInExplorer(params[0].path);
            }}
          ></Button>
          {/* Open File Button */}
          <Button
            size="mini"
            type="text"
            shape="circle"
            icon={<IconPlayArrow />}
            onClick={(e) => {
              e.stopPropagation();
              openFile(params[0].path);
            }}
          ></Button>
          {/* File Name */}
          <div className="flex-1">{params[0].path ?? "NULL"}</div>
        </Space>
      );
    } else {
      return (
        <div>
          <span>{params[0].path ?? "NULL"}</span>
        </div>
      );
    }
  } else {
    const paths = params.map((input, index) => <li key={index}>{input.path ?? "NULL"}</li>);
    return <ul className="list-disc list-inside">{paths}</ul>;
  }
};

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [taskEditorVisible, setTaskEditorVisible] = useState(false);

  const tableCols: TableColumnProps<Task>[] = [
    {
      title: "Status",
      width: "64px",
      align: "center",
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, record) => <Status task={record} />,
    },
    {
      title: "Inputs",
      render: (_, record) => <FilesList params={record.params.inputs} />,
    },
    {
      title: "Outputs",
      render: (_, record) => <FilesList params={record.params.outputs} />,
    },
    {
      title: "Progress",
      width: "20%",
      ellipsis: true,
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, record) => <Progress task={record} />,
    },
    {
      title: "Operations",
      fixed: "right",
      align: "center",
      width: "128px",
      render: (_, record) => <Operations task={record} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Buttons */}
      <Space>
        {/* Add Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            type="primary"
            icon={<IconNav />}
            onClick={() => setTaskEditorVisible(true)}
          ></Button>
        </Tooltip>
      </Space>

      {/* Tasks Table */}
      <Table
        stripe
        pagination={false}
        size="mini"
        rowKey="id"
        columns={tableCols}
        data={tasks}
        expandedRowRender={(record) => <></>}
        expandProps={{
          icon: ({ expanded, ...restProps }) =>
            expanded ? (
              <button {...restProps}>
                <IconDown />
              </button>
            ) : (
              <button {...restProps}>
                <IconRight />
              </button>
            ),
        }}
      ></Table>

      {/* Complex Task Editor Dialog */}
      <ComplexTaskEditor
        visible={taskEditorVisible}
        onVisibleChange={(visible) => setTaskEditorVisible(visible)}
      ></ComplexTaskEditor>
    </div>
  );
}
