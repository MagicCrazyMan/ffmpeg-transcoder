import { Button, Divider, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import {
  IconDelete,
  IconPause,
  IconPlayArrow,
  IconPlus,
  IconStop,
  IconSubscribeAdd,
} from "@arco-design/web-react/icon";
import { useState } from "react";
import ComplexTaskModifier from "../../components/task/ComplexTaskModifier";
import SimpleTasksAdding from "../../components/task/SimpleTasksAdding";
import { Task, useTaskStore } from "../../store/task";
import FilesList from "./FileList";
import Operations from "./Operations";
import Progress from "./Progress";
import Status from "./Status";

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const { tasks, startAllTasks, pauseAllTasks, stopAllTasks, removeAllTasks } = useTaskStore(
    (state) => state
  );

  const [complexTaskModifierVisible, setComplexTaskModifierVisible] = useState(false);
  const [simpleTasksAddingVisible, setSimpleTasksAddingVisible] = useState(false);

  const [modifyingTask, setModifyingTask] = useState<Task | undefined>(undefined);
  const onModify = (task: Task) => {
    setModifyingTask(task);
    setComplexTaskModifierVisible(true);
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
      width: "128px",
      render: (_, task) => <Operations task={task} onModify={onModify} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Space>
        {/* Add Multiple Simple Tasks Button */}
        <Tooltip content="Add Multiple Simple Tasks">
          <Button
            shape="circle"
            type="primary"
            status="success"
            icon={<IconPlus />}
            onClick={() => setSimpleTasksAddingVisible(true)}
          ></Button>
        </Tooltip>

        {/* Add or Modify Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            type="primary"
            status="success"
            icon={<IconSubscribeAdd />}
            onClick={() => setComplexTaskModifierVisible(true)}
          ></Button>
        </Tooltip>

        <Divider type="vertical"></Divider>

        {/* Start All Tasks Button */}
        <Tooltip content="Start All Tasks">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlayArrow />}
            onClick={startAllTasks}
          ></Button>
        </Tooltip>

        {/* Pause All Tasks Button */}
        <Tooltip content="Pause All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="warning"
            icon={<IconPause />}
            onClick={pauseAllTasks}
          ></Button>
        </Tooltip>

        {/* Stop All Tasks Button */}
        <Tooltip content="Stop All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconStop />}
            onClick={stopAllTasks}
          ></Button>
        </Tooltip>

        {/* Remove All Tasks Button */}
        <Tooltip content="Remove All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={removeAllTasks}
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

      {/* Simple Tasks Adding Dialog */}
      <SimpleTasksAdding
        visible={simpleTasksAddingVisible}
        onVisibleChange={(visible) => {
          setSimpleTasksAddingVisible(visible);
        }}
      ></SimpleTasksAdding>

      {/* Complex Task Modifier Dialog */}
      <ComplexTaskModifier
        task={modifyingTask}
        visible={complexTaskModifierVisible}
        onVisibleChange={(visible) => {
          setComplexTaskModifierVisible(visible);
          setModifyingTask(undefined);
        }}
      ></ComplexTaskModifier>
    </div>
  );
}
