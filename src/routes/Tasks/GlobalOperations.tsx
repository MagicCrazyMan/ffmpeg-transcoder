import { Button, Divider, Space, Tooltip, Typography } from "@arco-design/web-react";
import {
  IconDelete,
  IconPause,
  IconPlayArrow,
  IconPlus,
  IconStop,
  IconSubscribeAdd,
} from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { useTaskStore } from "../../store/task";

export default function GlobalOperations({
  setSimpleTasksAddingVisible,
  setComplexTaskModifierVisible,
}: {
  setSimpleTasksAddingVisible: (visible: boolean) => void;
  setComplexTaskModifierVisible: (visible: boolean) => void;
}) {
  const { tasks, startAllTasks, pauseAllTasks, stopAllTasks, removeAllTasks } = useTaskStore();
  const {
    total,
    idlesCount,
    commandingsCount,
    erroredsCount,
    finishedsCount,
    pasuingsCount,
    queueingsCount,
    runningsCount,
    stoppedsCount,
  } = useMemo(() => {
    let idlesCount = 0;
    let commandingsCount = 0;
    let queueingsCount = 0;
    let runningsCount = 0;
    let pasuingsCount = 0;
    let stoppedsCount = 0;
    let finishedsCount = 0;
    let erroredsCount = 0;

    tasks.forEach((task) => {
      switch (task.state.type) {
        case "Idle":
          idlesCount++;
          break;
        case "Commanding":
          commandingsCount++;
          break;
        case "Queueing":
          queueingsCount++;
          break;
        case "Running":
          runningsCount++;
          break;
        case "Pausing":
          pasuingsCount++;
          break;
        case "Stopped":
          stoppedsCount++;
          break;
        case "Finished":
          finishedsCount++;
          break;
        case "Errored":
          erroredsCount++;
          break;
      }
    });

    return {
      total: tasks.length,
      idlesCount,
      commandingsCount,
      queueingsCount,
      runningsCount,
      pasuingsCount,
      stoppedsCount,
      finishedsCount,
      erroredsCount,
    };
  }, [tasks]);

  return (
    <div className="flex justify-between items-center flex-wrap">
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

      <Space>
        <Typography.Text type="secondary">{total} Tasks</Typography.Text>|
        <Typography.Text type="secondary">{idlesCount} Idles</Typography.Text>|
        <Typography.Text type="primary">{commandingsCount} Commanding</Typography.Text>|
        <Typography.Text type="primary">{runningsCount} Running</Typography.Text>|
        <Typography.Text type="warning">{queueingsCount} Queueing</Typography.Text>|
        <Typography.Text type="warning">{pasuingsCount} Pausing</Typography.Text>|
        <Typography.Text type="error">{stoppedsCount} Stopped</Typography.Text>|
        <Typography.Text type="error">{erroredsCount} Errored</Typography.Text>|
        <Typography.Text type="success">{finishedsCount} Finish</Typography.Text>
      </Space>
    </div>
  );
}
