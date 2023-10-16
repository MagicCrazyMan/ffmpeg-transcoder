import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconSubscribeAdd } from "@arco-design/web-react/icon";
import { useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import ComplexTaskModifier from "../../components/ComplexTaskModifier";
import FilesList from "./FileList";
import Operations from "./Operations";
import Progress from "./Progress";
import Status from "./Status";

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [taskModifierVisible, setTaskModifierVisible] = useState(false);
  const [modifyingTask, setModifyingTask] = useState<Task | undefined>(undefined);
  const onModify = (task: Task) => {
    setModifyingTask(task);
    setTaskModifierVisible(true);
  };

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
      title: "Details",
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
      render: (_, task) => <Operations task={task} onModify={onModify} />,
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
            icon={<IconSubscribeAdd />}
            onClick={() => setTaskModifierVisible(true)}
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
      ></Table>

      {/* Complex Task Editor Dialog */}
      <ComplexTaskModifier
        task={modifyingTask}
        visible={taskModifierVisible}
        onVisibleChange={(visible) => {
          setTaskModifierVisible(visible);
          setModifyingTask(undefined);
        }}
      ></ComplexTaskModifier>
    </div>
  );
}
