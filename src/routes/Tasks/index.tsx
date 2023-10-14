import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDown, IconFolder, IconNav, IconRight } from "@arco-design/web-react/icon";
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
  const openDirectory = (path?: string) => {
    if (!path) return;
  };

  if (params.length === 1) {
    if (params[0].path) {
      return (
        <div className="flex items-center">
          <Button
            className="flex-shrink-0 flex-grow-0"
            size="default"
            type="text"
            shape="circle"
            icon={<IconFolder />}
            onClick={() => openDirectory(params[0].path)}
          ></Button>
          <div>{params[0].path ?? "NULL"}</div>
        </div>
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
          expandRowByClick: true,
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
