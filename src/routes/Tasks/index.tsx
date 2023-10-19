import { Table, TableColumnProps } from "@arco-design/web-react";
import { useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import ComplexTaskModifier from "../../components/task/ComplexTaskModifier";
import SimpleTasksModifier from "../../components/task/SimpleTasksModifier";
import FilesList from "./FileList";
import GlobalOperations from "./GlobalOperations";
import Progress from "./Progress";
import RowOperations from "./RowOperations";
import Status from "./Status";

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

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
      render: (_, task) => <RowOperations task={task} onModify={onModify} />,
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-4">
      <GlobalOperations
        setComplexTaskModifierVisible={setComplexTaskModifierVisible}
        setSimpleTasksAddingVisible={setSimpleTasksAddingVisible}
      />

      {/* Tasks Table */}
      <Table
        stripe
        pagination={false}
        size="mini"
        rowKey="id"
        columns={tableCols}
        data={tasks}
        scroll={{ x: "1200px", y: "calc(100vh - 112px)" }}
      ></Table>

      {/* Simple Tasks Adding Dialog */}
      <SimpleTasksModifier
        visible={simpleTasksAddingVisible}
        onVisibleChange={(visible) => {
          setSimpleTasksAddingVisible(visible);
        }}
      ></SimpleTasksModifier>

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
