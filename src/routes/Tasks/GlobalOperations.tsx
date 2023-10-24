import { Button, Divider, Space, Tooltip } from "@arco-design/web-react";
import {
  IconDelete,
  IconPause,
  IconPlayArrow,
  IconPlus,
  IconStop,
  IconSubscribeAdd,
} from "@arco-design/web-react/icon";
import { useTaskStore } from "../../store/task";

export default function GlobalOperations({
  setSimpleTasksAddingVisible,
  setComplexTaskModifierVisible,
}: {
  setSimpleTasksAddingVisible: (visible: boolean) => void;
  setComplexTaskModifierVisible: (visible: boolean) => void;
}) {
  const { startAllTasks, pauseAllTasks, stopAllTasks, removeAllTasks } = useTaskStore();

  return (
    <div>
      <Space>
        {/* Add Multiple Simple Tasks Button */}
        <Tooltip content="Add Multiple Simple Tasks">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlus />}
            onClick={() => setSimpleTasksAddingVisible(true)}
          ></Button>
        </Tooltip>

        {/* Add or Modify Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            type="primary"
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
    </div>
  );
}
