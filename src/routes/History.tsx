import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDelete, IconPlus } from "@arco-design/web-react/icon";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NULLPath from "../components/NULLPath";
import { HistoryTask } from "../libs/history";
import { TaskArgsItem } from "../libs/task";
import { useHistoryStore } from "../store/history";
import { useTaskStore } from "../store/task";

const FileItem = ({ path }: { path?: string }) => {
  return <span className="flex-1">{path ?? <NULLPath />}</span>;
};

const FilesList = ({ args }: { args: TaskArgsItem[] }) => {
  if (args.length === 1) {
    return <FileItem path={args[0].path} />;
  } else {
    const paths = args.map((param, index) => (
      <li key={index}>
        <FileItem path={param.path} />
      </li>
    ));
    return <ul className="list-disc list-inside">{paths}</ul>;
  }
};

/**
 * Page listing history tasks
 */
export default function HistoryPage() {
  const navigate = useNavigate();
  const { addTasks } = useTaskStore();
  const { storage, removeHistoryTasks } = useHistoryStore();

  const [selectedRows, setSelectedRows] = useState<HistoryTask[]>([]);

  const handleAddTasks = (tasks: HistoryTask[]) => {
    const args = tasks.map(({ args }) => args);
    addTasks(...args);
    navigate("/tasks");
  };

  const handleRemoveTasks = (tasks: HistoryTask[]) => {
    const ids = tasks.map(({ id }) => id);
    removeHistoryTasks(...ids);
  };

  const tableCols: TableColumnProps<HistoryTask>[] = [
    {
      title: "Inputs",
      render: (_, task) => <FilesList args={task.args.inputs} />,
    },
    {
      title: "Outputs",
      render: (_, task) => <FilesList args={task.args.outputs} />,
    },
    {
      title: "Creation Time",
      render: (_, task) => dayjs(task.creationTime).format("YYYY-MM-DD HH:ss:mm"),
      sorter: (a: HistoryTask, b: HistoryTask) => a.creationTime.diff(b.creationTime),
      defaultSortOrder: "descend",
    },
    {
      title: "Operations",
      fixed: "right",
      width: "6rem",
      render: (_, task) => {
        return (
          <Space>
            {/* Add To Task Button */}
            <Button
              size="mini"
              shape="circle"
              type="primary"
              icon={<IconPlus />}
              onClick={() => {
                handleAddTasks([task]);
              }}
            />

            {/* Delete History Button */}
            <Button
              size="mini"
              shape="circle"
              type="primary"
              status="danger"
              icon={<IconDelete />}
              onClick={() => handleRemoveTasks([task])}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-4">
      <Space className="mb-4">
        {/* Add All Selected Tasks */}
        <Tooltip content="Add All Selected Tasks">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlus />}
            disabled={selectedRows.length === 0}
            onClick={() => {
              handleAddTasks(selectedRows);
            }}
          ></Button>
        </Tooltip>

        {/* Delete All Selected Tasks */}
        <Tooltip content="Delete All Selected Tasks">
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            disabled={selectedRows.length === 0}
            onClick={() => {
              handleRemoveTasks(selectedRows);
            }}
          ></Button>
        </Tooltip>
      </Space>

      {/* History Tasks Table */}
      <Table
        stripe
        virtualized
        size="mini"
        rowKey="id"
        pagination={false}
        rowSelection={{
          onChange(_, rows) {
            setSelectedRows(rows);
          },
        }}
        columns={tableCols}
        data={storage.tasks}
      ></Table>
    </div>
  );
}
