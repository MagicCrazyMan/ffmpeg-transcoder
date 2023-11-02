import { Table, TableColumnProps } from "@arco-design/web-react";
import { ComponentsProps } from "@arco-design/web-react/es/Table/interface";
import { IconDragDotVertical } from "@arco-design/web-react/icon";
import { ReactNode, useMemo, useState } from "react";
import { SortableContainer, SortableElement, SortableHandle } from "react-sortable-hoc";
import ComplexTaskModifier from "../../components/task/ComplexTaskModifier";
import SimpleTasksModifier from "../../components/task/SimpleTasksModifier";
import { Task } from "../../libs/task";
import { useTaskStore } from "../../store/task";
import Details from "./Details";
import FilesList from "./FileList";
import GlobalOperations from "./GlobalOperations";
import RowOperations from "./RowOperations";
import Status from "./Status";
import { TaskStateCode } from "../../libs/task/state_machine";

const DragHandle = SortableHandle(() => (
  <IconDragDotVertical
    style={{
      cursor: "move",
      color: "#555",
    }}
  />
));
const SortableWrapper = SortableContainer((props: { children: ReactNode }) => <tbody {...props} />);
const SortableItem = SortableElement((props: { children: ReactNode[]; className: string }) => (
  <tr {...props} />
));

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const { tasks, moveTask } = useTaskStore();

  const [complexTaskModifierVisible, setComplexTaskModifierVisible] = useState(false);
  const [simpleTasksAddingVisible, setSimpleTasksAddingVisible] = useState(false);

  const [modifyingTask, setModifyingTask] = useState<Task | undefined>(undefined);
  const onModify = (task: Task) => {
    setModifyingTask(task);
    setComplexTaskModifierVisible(true);
  };

  const isTaskRunning = useMemo(
    () => tasks.some((task) => task.state.code === TaskStateCode.Running),
    [tasks]
  );

  const onSortEnd = ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
    moveTask(oldIndex, newIndex);
  };

  const DraggableContainer = (props: { children: ReactNode[] }) => (
    <SortableWrapper
      useDragHandle
      onSortEnd={onSortEnd}
      helperContainer={() => document.querySelector(".draggable-table table tbody")!}
      updateBeforeSortStart={({ node }) => {
        const tds = node.querySelectorAll("td");
        tds.forEach((td) => {
          td.style.width = td.clientWidth + "px";
        });
      }}
      {...props}
    />
  );
  const DraggableRow = (props: {
    children: ReactNode[];
    className: string;
    index: number;
    record: Task;
  }) => {
    const { index, ...rest } = props;
    return <SortableItem index={index} {...rest} />;
  };

  const components: ComponentsProps = {
    header: {
      operations: () => [
        {
          node: <th />,
          width: 40,
        },
      ],
    },
    body: {
      operations: () => [
        {
          // only sortable when no task is running
          node: (
            <td>
              <div className="arco-table-cell">{isTaskRunning ? null : <DragHandle />}</div>
            </td>
          ),
          width: 40,
        },
      ],
      tbody: DraggableContainer,
      row: DraggableRow,
    },
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
      render: (_, task) => <Details task={task} />,
    },
    {
      title: "Operations",
      fixed: "right",
      width: "14rem",
      align: "center",
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
        data={tasks}
        columns={tableCols}
        components={components}
        className="draggable-table"
        rowClassName={() => "h-12"}
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
