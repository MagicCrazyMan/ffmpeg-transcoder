import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDown, IconNav, IconRight } from "@arco-design/web-react/icon";
import { useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import FilesList from "./FileList";
import Operations from "./Operations";
import Progress from "./Progress";
import Status from "./Status";

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
      render: (_, task) => <Status task={task} />,
    },
    {
      title: "Inputs",
      render: (_, task) => <FilesList type="input" task={task} />,
    },
    {
      title: "Outputs",
      render: (_, task) => <FilesList type="output" task={task} />,
    },
    {
      title: "Progress",
      width: "20%",
      ellipsis: true,
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, task) => <Progress task={task} />,
    },
    {
      title: "Operations",
      fixed: "right",
      align: "center",
      width: "128px",
      render: (_, task) => <Operations task={task} />,
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
