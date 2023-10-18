import { Button, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete, IconPlus } from "@arco-design/web-react/icon";
import dayjs from "dayjs";
import { HistoryTask, useHistoryStore } from "../store/history";
import { TaskInputParams, TaskOutputParams, useTaskStore } from "../store/task";
import { useNavigate } from "react-router-dom";

const FileItem = ({ path }: { path?: string }) => {
  return <span className="flex-1">{path ?? "NULL"}</span>;
};

const FilesList = ({ params }: { params: TaskInputParams[] | TaskOutputParams[] }) => {
  if (params.length === 1) {
    return <FileItem path={params[0].path} />;
  } else {
    const paths = params.map((param, index) => (
      <li key={index}>
        <FileItem path={param.path} />
      </li>
    ));
    return <ul className="list-disc list-inside">{paths}</ul>;
  }
};

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const navigate = useNavigate();
  const { addTasks } = useTaskStore();
  const { tasks, removeHistoryTask } = useHistoryStore();

  const tableCols: TableColumnProps<HistoryTask>[] = [
    {
      title: "Inputs",
      render: (_, task) => <FilesList params={task.params.inputs} />,
    },
    {
      title: "Outputs",
      render: (_, task) => <FilesList params={task.params.outputs} />,
    },
    {
      title: "Creation Time",
      render: (_, task) => dayjs(task.creationTime).format("YYYY-MM-DD HH:ss:mm"),
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
                addTasks(task.params);
                navigate("/tasks");
              }}
            />

            {/* Delete History Button */}
            <Button
              size="mini"
              shape="circle"
              type="primary"
              status="danger"
              icon={<IconDelete />}
              onClick={() => removeHistoryTask(task.id)}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-4">
      <Table
        stripe
        size="mini"
        rowKey="id"
        pagination={false}
        columns={tableCols}
        data={tasks}
      ></Table>
    </div>
  );
}
